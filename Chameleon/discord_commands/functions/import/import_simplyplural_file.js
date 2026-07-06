/**
 * SimplyPlural file-based import
 * Parses SP export JSON + avatar folder, provides preview/import functions
 * that mirror the API-based functions in import_simplyplural.js.
 *
 * Reuses processSimplyPluralData from import_simplyplural.js for core
 * member/group entity creation. Handles file-specific features separately:
 *   - frontHistory → shifts
 *   - customFields → entity.age mapping
 *   - privacyBuckets → PrivacyBucket documents
 *   - users[] → system metadata
 *   - Avatar folder (local PNG files keyed by memberId)
 *
 * SP export JSON structure:
 *   users[]          — system info: { username, color, desc, avatarUuid }
 *   members[]        — { name, desc, avatarUrl, color, pronouns, pkId, id, uid, privacy, archived, buckets, created }
 *   groups[]         — { name, desc, color, uid, members[] }
 *   frontHistory[]   — { member, startTime, endTime, uuid }
 *   customFields[]   — { name, oid }
 *   privacyBuckets[] — { name, color }
 *   friends[]        — { name, uid, ... }
 *   fronters[]       — { uid, ... }
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { processSimplyPluralData } = require('./import_simplyplural');
const { uploadToR2 } = require('./r2_sync');
const { Shift } = require('../../../schemas/front');
const { PrivacyBucket } = require('../../../schemas/settings');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const utils = require('../bot_utils');

// ============================================
// MAIN IMPORT FUNCTION
// ============================================

/**
 * Import from a SimplyPlural JSON export file + optional avatar folder.
 *
 * @param {Object} system - Mongoose System document
 * @param {Object} user - Mongoose User document
 * @param {string|Object} fileData - JSON string or parsed object
 * @param {Object} options - Import options (may include avatarFolderPath)
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<Object>} Import result
 */
async function importSimplyPluralFile(system, user, fileData, options, onProgress) {
    const emit = onProgress || (() => {});
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    emit({ phase: 'fetching', message: 'Parsing Simply Plural export file...' });

    // Validate SP export format
    if (!data.members && !data.groups)
        throw new Error('This doesn\'t look like a Simply Plural export file.');

    const memberCount = Array.isArray(data.members)
        ? data.members.length
        : Object.values(data.members || {}).length;
    const groupCount = Array.isArray(data.groups)
        ? data.groups.length
        : Object.values(data.groups || {}).length;
    const shiftCount = data.frontHistory?.length || 0;
    const friendCount = data.friends?.length || 0;

    emit({
        phase: 'fetching',
        message: `Found ${memberCount} member${memberCount !== 1 ? 's' : ''}, `
            + `${groupCount} group${groupCount !== 1 ? 's' : ''}, `
            + `${shiftCount} shift${shiftCount !== 1 ? 's' : ''}, `
            + `${friendCount} friend${friendCount !== 1 ? 's' : ''}. Starting import...`
    });

    // ── Step 1: Transform SP export fields to match processSimplyPluralData ──
    const transformedData = transformSPExportData(data);

    // ── Step 2: Handle avatar folder (pre-upload local PNGs to R2) ──
    const avatarMediaMap = new Map(); // memberId → mediaSchema object
    if (options.avatarFolderPath && fs.existsSync(options.avatarFolderPath)) {
        emit({ phase: 'avatars', message: 'Processing avatar folder...' });
        await handleAvatarFolder(
            transformedData.members,
            options.avatarFolderPath,
            system,
            avatarMediaMap
        );
        emit({
            phase: 'avatars',
            message: `Uploaded ${avatarMediaMap.size} avatar${avatarMediaMap.size !== 1 ? 's' : ''} from folder.`
        });
    }

    // ── Step 3: Core import via shared processor ──
    const result = await processSimplyPluralData(system, transformedData, options, onProgress);

    // ── Step 4: Build member ID map for shift/custom-field linking ──
    const memberIdMap = buildMemberIdMap(result.importedMembers);

    // ── Step 5: Apply pre-uploaded avatars (override syncEntityImages result) ──
    if (avatarMediaMap.size > 0 && !options.dryRun) {
        for (const entity of result.importedMembers) {
            const spId = entity.metadata?.simplyPluralId;
            if (spId && avatarMediaMap.has(spId)) {
                entity.avatar = avatarMediaMap.get(spId);
                await entity.save().catch(() => {});
            }
        }
    }

    // ── Step 6: frontHistory → shifts ──
    if (!options.noSwitches && Array.isArray(data.frontHistory) && data.frontHistory.length > 0) {
        emit({
            phase: 'switches',
            current: 0,
            total: data.frontHistory.length,
            message: `Importing ${data.frontHistory.length} front history entries...`
        });
        const switchResult = await importSPFrontHistory(
            system, data.frontHistory, memberIdMap, options, onProgress
        );
        result.switchesImported = switchResult.count;
        result.importedShifts = switchResult.shifts || [];
    }

    // ── Step 7: Custom fields → entity.age + metadata ──
    if (Array.isArray(data.customFields) && data.customFields.length > 0) {
        applyCustomFields(result.importedMembers, data.customFields, data.members, options);
    }

    // ── Step 8: Privacy settings from member.privacy ──
    if (Array.isArray(data.members)) {
        await applyMemberPrivacy(system, result.importedMembers, data.members, options);
    }

    // ── Step 9: System info from users[] ──
    if (Array.isArray(data.users) && data.users.length > 0) {
        updateSystemInfo(system, data.users[0]);
    }

    // ── Step 10: Privacy buckets from SP export ──
    if (Array.isArray(data.privacyBuckets) && data.privacyBuckets.length > 0) {
        await importPrivacyBuckets(system, data.privacyBuckets, options);
    }

    // ── Step 11: Store custom field definitions in system metadata ──
    if (Array.isArray(data.customFields) && data.customFields.length > 0 && !options.dryRun) {
        system.metadata = system.metadata || {};
        system.metadata.spCustomFieldDefs = data.customFields.map(cf => ({
            name: cf.name,
            oid: cf.oid,
        }));
    }

    // ── Step 12: Final save ──
    emit({ phase: 'saving', message: 'Saving system...' });
    if (!options.dryRun) {
        await system.save();
    }

    return result;
}

// ============================================
// FORMAT TRANSFORMATION
// ============================================

/**
 * Transform SP export field names to match what processSimplyPluralData expects.
 *
 * SP export → processSimplyPluralData mapping:
 *   privacy  → private     (boolean)
 *   created  → createdAt   (ISO string)
 *   id       → uid fallback (both kept; processSimplyPluralData uses uid || id)
 */
function transformSPExportData(data) {
    const members = (Array.isArray(data.members) ? data.members : Object.values(data.members || {}))
        .map(m => ({
            ...m,
            private: m.privacy,
            createdAt: m.created || m.createdAt,
            uid: m.uid || m.id,
        }));

    const groups = Array.isArray(data.groups) ? data.groups : Object.values(data.groups || {});

    return { members, groups };
}

// ============================================
// AVATAR FOLDER HANDLING
// ============================================

/**
 * For each member that lacks an avatarUrl but has a local PNG in the avatar folder,
 * read the file and upload it to R2. Stores the resulting media object in avatarMediaMap.
 */
async function handleAvatarFolder(members, avatarFolderPath, system, avatarMediaMap) {
    const userId = system.users?.[0] || system.discordId;
    if (!userId) return;

    for (const member of members) {
        if (member.avatarUrl) continue; // already has a URL

        const memberId = member.uid || member.id;
        if (!memberId) continue;

        const filePath = path.join(avatarFolderPath, `${memberId}.png`);
        if (!fs.existsSync(filePath)) continue;

        try {
            const buffer = fs.readFileSync(filePath);
            const media = await uploadToR2(buffer, `${memberId}.png`, 'image/png', userId.toString(), 'Alter', 'avatar');
            if (media) {
                avatarMediaMap.set(memberId, media);
                // Also set avatarUrl so processSimplyPluralData creates the entity with a URL
                // (syncEntityImages will be a no-op since we override later)
                member.avatarUrl = media.url;
            }
        } catch (err) {
            console.warn(`[Import] Failed to upload avatar for member ${memberId}:`, err.message);
        }
    }
}

// ============================================
// MEMBER ID MAP BUILDER
// ============================================

/**
 * Build a map from SP member UID → { id: ObjectId, type: 'alter'|'state' }
 * using the metadata.simplyPluralId stored on each imported entity.
 */
function buildMemberIdMap(importedMembers) {
    const map = new Map();
    for (const member of importedMembers) {
        const spId = member.metadata?.simplyPluralId;
        if (spId) {
            map.set(spId, {
                id: member._id,
                type: member.entityType || 'alter',
            });
        }
    }
    return map;
}

// ============================================
// FRONT HISTORY → SHIFTS
// ============================================

/**
 * Convert SP frontHistory entries into Shift documents.
 *
 * @param {Object} system - System document
 * @param {Array} frontHistory - SP front history entries [{ member, startTime, endTime, uuid }]
 * @param {Map} memberIdMap - SP member ID → { id, type }
 * @param {Object} options - Import options
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<{ count: number, shifts: Array }>}
 */
async function importSPFrontHistory(system, frontHistory, memberIdMap, options, onProgress) {
    const emit = onProgress || (() => {});
    const dryRun = options.dryRun || !system?._id;

    if (!system.front) system.front = {};
    if (!system.front.layers || system.front.layers.length === 0) {
        system.front.layers = [{
            _id: new mongoose.Types.ObjectId(),
            name: 'Main',
            shifts: [],
        }];
    }

    const targetLayer = system.front.layers[0];

    // Sort ascending (oldest first)
    const sorted = [...frontHistory].sort((a, b) =>
        new Date(a.startTime) - new Date(b.startTime)
    );

    let imported = 0;
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        emit({
            phase: 'switches',
            current: i + 1,
            total: sorted.length,
            message: `Importing shift ${i + 1}/${sorted.length}...`
        });

        const mapped = memberIdMap.get(entry.member);
        if (!mapped) continue;

        let s_type = mapped.type || 'alter';
        let type_name = 'Unknown';
        if (!dryRun) {
            const alter = await Alter.findById(mapped.id);
            const state = alter ? null : await State.findById(mapped.id);
            s_type = alter ? 'alter' : 'state';
            type_name = (alter || state)?.name?.display || 'Unknown';
        }

        const startTime = new Date(entry.startTime);
        const endTime = entry.endTime ? new Date(entry.endTime) : null;

        const shiftData = {
            s_type,
            ID: dryRun ? new mongoose.Types.ObjectId().toString() : system._id.toString(),
            type_name,
            startTime,
            endTime,
            statuses: [{
                startTime,
                endTime,
                layerID: targetLayer._id,
            }],
        };

        if (dryRun) {
            targetLayer.shifts.push(shiftData);
        } else {
            const shift = new Shift(shiftData);
            await shift.save();
            targetLayer.shifts.push(shift._id);
        }
        imported++;
    }

    if (!dryRun) {
        await system.save();
    }

    return { count: imported, shifts: dryRun ? targetLayer.shifts : [] };
}

// ============================================
// CUSTOM FIELDS → AGE + METADATA
// ============================================

/**
 * Map custom fields to imported entities.
 * - "Age" field → entity.age
 * - Other fields → entity.metadata.customFields
 *
 * Custom field values may be embedded in source member objects (e.g. spMember.age)
 * or referenced by oid. Handles both cases.
 */
function applyCustomFields(importedMembers, customFields, sourceMembers, options) {
    if (options.dryRun) return;

    // Build a lookup from SP member ID → source member
    const sourceArray = Array.isArray(sourceMembers)
        ? sourceMembers
        : Object.values(sourceMembers || {});
    const sourceMap = new Map();
    for (const s of sourceArray) {
        sourceMap.set(s.uid || s.id, s);
    }

    const ageFieldDef = customFields.find(cf => cf.name?.toLowerCase() === 'age');

    for (const entity of importedMembers) {
        const spId = entity.metadata?.simplyPluralId;
        const source = sourceMap.get(spId);
        if (!source) continue;

        // Apply Age from source member (if present) or custom field value
        const age = source.age || source.AGE || source.birthday;
        if (age && ageFieldDef) {
            entity.age = age;
            entity.save().catch(() => {});
        }

        // Store any other custom field values as metadata
        const otherCustomFields = customFields
            .filter(cf => cf.name?.toLowerCase() !== 'age')
            .map(cf => ({ name: cf.name, oid: cf.oid }));

        if (otherCustomFields.length > 0) {
            entity.metadata = entity.metadata || {};
            entity.metadata.customFieldDefs = otherCustomFields;
            entity.save().catch(() => {});
        }
    }
}

// ============================================
// MEMBER PRIVACY SETTINGS
// ============================================

/**
 * Apply privacy settings from the SP export's `privacy` boolean field.
 * Private members get the "Private" privacy bucket assignment.
 */
async function applyMemberPrivacy(system, importedMembers, sourceMembers, options) {
    if (options.dryRun) return;

    const sourceMap = new Map();
    for (const s of sourceMembers) {
        sourceMap.set(s.uid || s.id, s);
    }

    for (const entity of importedMembers) {
        const spId = entity.metadata?.simplyPluralId;
        const source = sourceMap.get(spId);
        if (!source || !source.privacy) continue;

        entity.setting = entity.setting || {};
        entity.setting.privacy = entity.setting.privacy || [];

        const hasDefault = entity.setting.privacy.find(p => p.bucket === 'default');
        if (!hasDefault) {
            entity.setting.privacy.push({ bucket: 'default', settings: {} });
        }

        entity.save().catch(() => {});
    }
}

// ============================================
// SYSTEM INFO FROM users[]
// ============================================

/**
 * Update system metadata from the SP export's users[0] entry.
 * Only sets values that aren't already populated.
 */
function updateSystemInfo(system, userData) {
    if (!userData) return;

    system.metadata = system.metadata || {};
    system.metadata.spUsername = userData.username;

    // Set system color if not already set
    if (userData.color && !system.color) {
        system.color = userData.color;
    }

    // Set system description if not already set
    if (userData.desc && !system.description) {
        system.description = userData.desc;
    }
}

// ============================================
// PRIVACY BUCKETS IMPORT
// ============================================

/**
 * Import privacy buckets from the SP export.
 * Creates PrivacyBucket documents and links them to the system.
 */
async function importPrivacyBuckets(system, spPrivacyBuckets, options) {
    if (options.dryRun) return;

    system.privacyBuckets = system.privacyBuckets || [];

    for (const spBucket of spPrivacyBuckets) {
        // Skip if bucket with this name already exists
        const existing = await PrivacyBucket.findOne({
            _id: { $in: system.privacyBuckets },
            name: spBucket.name,
        });
        if (existing) continue;

        const bucket = new PrivacyBucket({
            name: spBucket.name,
            friends: [],
        });
        await bucket.save();
        system.privacyBuckets.push(bucket._id);
    }
}

// ============================================
// PREVIEW FUNCTIONS
// ============================================

/**
 * Preview a SimplyPlural JSON export file.
 * Returns member/group/shift previews without writing anything.
 *
 * @param {Object} system - System document
 * @param {string|Object} fileData - JSON string or parsed object
 * @returns {Promise<Object>} Preview with members, groups, shifts, systemInfo
 */
async function previewSimplyPluralFile(system, fileData) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;
    if (!data.members && !data.groups)
        throw new Error('Not a Simply Plural export file.');

    return await previewSimplyPluralFileData(system, data);
}

/**
 * Generate a full preview from parsed SP export data.
 *
 * @param {Object} system - System document
 * @param {Object} data - Parsed SP export JSON
 * @returns {Promise<Object>} { members, groups, shifts, systemInfo, counts }
 */
async function previewSimplyPluralFileData(system, data) {
    // ── Members ──
    const members = [];
    const spMembers = Array.isArray(data.members)
        ? data.members
        : Object.values(data.members || {});

    for (const spMember of spMembers) {
        if (spMember.archived) continue;

        let existingAlter = null;
        let existingState = null;
        try {
            existingAlter = await Alter.findOne({
                _id: { $in: system.alters?.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spMember.name)}$`, 'i') }
            });
            if (!existingAlter) {
                existingState = await State.findOne({
                    _id: { $in: system.states?.IDs || [] },
                    'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spMember.name)}$`, 'i') }
                });
            }
        } catch {}

        const existing = existingAlter || existingState;

        // Check for age on source member
        const age = spMember.age || spMember.AGE || spMember.birthday || null;

        members.push({
            sourceId: spMember.uid || spMember.id,
            name: spMember.name,
            avatar: spMember.avatarUrl || null,
            description: spMember.desc || null,
            pronouns: spMember.pronouns || null,
            color: spMember.color || null,
            age,
            proxy: [],
            action: existing ? 'update' : 'new',
            existingId: existing?._id?.toString() || null,
            visibility: spMember.private ? 'private' : 'public',
            banner: spMember.bannerUrl || null,
            isPrivate: !!spMember.private,
        });
    }

    // ── Groups ──
    const groups = [];
    const spGroups = Array.isArray(data.groups)
        ? data.groups
        : Object.values(data.groups || {});

    for (const spGroup of spGroups) {
        let existingGroup = null;
        try {
            existingGroup = await Group.findOne({
                _id: { $in: system.groups?.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spGroup.name)}$`, 'i') }
            });
        } catch {}

        groups.push({
            sourceId: spGroup.uid || spGroup.name,
            name: spGroup.name,
            description: spGroup.desc || null,
            color: spGroup.color || null,
            memberSourceIds: spGroup.members || [],
            action: existingGroup ? 'update' : 'new',
            existingId: existingGroup?._id?.toString() || null,
            visibility: 'public',
        });
    }

    // ── Shifts (from frontHistory) ──
    const shifts = [];
    if (Array.isArray(data.frontHistory)) {
        // Build name lookup from source members
        const memberNames = new Map();
        for (const m of spMembers) {
            memberNames.set(m.uid || m.id, m.name);
        }

        const sorted = [...data.frontHistory].sort((a, b) =>
            new Date(a.startTime) - new Date(b.startTime)
        );

        for (const entry of sorted) {
            shifts.push({
                memberName: memberNames.get(entry.member) || 'Unknown',
                memberId: entry.member,
                startTime: entry.startTime,
                endTime: entry.endTime || null,
            });
        }
    }

    // ── System info ──
    const systemInfo = Array.isArray(data.users) && data.users[0]
        ? {
            username: data.users[0].username,
            color: data.users[0].color,
            description: data.users[0].desc,
        }
        : null;

    // ── Counts ──
    const counts = {
        members: members.length,
        new: members.filter(m => m.action === 'new').length,
        update: members.filter(m => m.action === 'update').length,
        groups: groups.length,
        shifts: shifts.length,
        friends: Array.isArray(data.friends) ? data.friends.length : 0,
        currentFronters: Array.isArray(data.fronters) ? data.fronters.length : 0,
        customFields: Array.isArray(data.customFields) ? data.customFields.length : 0,
        privacyBuckets: Array.isArray(data.privacyBuckets) ? data.privacyBuckets.length : 0,
    };

    return { members, groups, shifts, systemInfo, counts };
}

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
    importSimplyPluralFile,
    previewSimplyPluralFile,
    previewSimplyPluralFileData,
};
