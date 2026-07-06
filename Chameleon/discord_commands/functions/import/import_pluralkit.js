// PluralKit-specific import functions
// Extracted from import_functions.js — PluralKit API, file import, data processing, entity helpers

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
const { checkProxyExists } = require('../bot_utils');
const utils = require('../bot_utils');
const { syncImageToR2 } = require('./r2_sync');
const { syncEntityImages, filterConflictingProxies, isMemberSelected } = require('./helpers');
const { TARGET_APP, TARGET_DISCORD } = require('./constants');

// ============================================
// URL PARSING (Phase 4)
// ============================================

function parsePluralKitUrl(input) {
    if (!input) return null;

    // URL format: pluralkit.me/systems/abc12 or pluralkit.me/systems/abc12-xyz
    const urlMatch = input.match(/pluralkit\.me\/systems\/([a-zA-Z0-9-]+)/i);
    if (urlMatch) return urlMatch[1].replace(/-/g, '');

    // Short ID: 5-6 alphanumeric chars
    if (/^[a-zA-Z0-9]{5,6}$/.test(input)) return input;

    // UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input))
        return input;

    return null;
}

// ============================================
// PLURALKIT API IMPORT (Phase 1 — pkapi.js)
// ============================================

async function importPluralKitAPI(system, user, token, options, onProgress) {
    const emit = onProgress || (() => {});
    const PKAPI = require('pkapi.js').default;
    const api = new PKAPI({ token, user_agent: 'Systemiser Discord Bot (import)' });

    emit({ phase: 'fetching', message: 'Connecting to PluralKit API...' });

    // Fetch system info
    const pkSystem = await api.getSystem({ token });

    emit({ phase: 'fetching', message: 'Fetching members...' });

    // Fetch members (returns Map, convert to Array)
    const pkMembers = Array.from((await api.getMembers({ token })).values());

    emit({ phase: 'fetching', message: `Found ${pkMembers.length} member${pkMembers.length !== 1 ? 's' : ''}. Fetching groups...` });

    // Fetch groups if not disabled (returns Map, convert to Array)
    let pkGroups = [];
    if (!options.noGroups) {
        const raw = await api.getGroups({ token });
        pkGroups = raw instanceof Map ? Array.from(raw.values()) : (Array.isArray(raw) ? raw : []);
    }

    emit({ phase: 'fetching', message: `Found ${pkGroups.length} group${pkGroups.length !== 1 ? 's' : ''}. Fetching switch history...` });

    // Fetch switches if not disabled
    let pkSwitches = [];
    if (!options.noSwitches) {
        const result = await api.getSwitches({ token, raw: false });
        pkSwitches = result?.switches ? Array.from(result.switches.values()) : [];
    }

    emit({ phase: 'fetching', message: `Found ${pkSwitches.length} switch${pkSwitches.length !== 1 ? 'es' : ''}. Starting import...` });

    const result = await processPluralKitData(system, user, {
        system: pkSystem,
        members: pkMembers,
        groups: pkGroups,
        switches: pkSwitches
    }, options, onProgress);

    return result;
}

// ============================================
// PLURALKIT FILE IMPORT
// ============================================

async function importPluralKitFile(system, user, fileData, options, onProgress) {
    const emit = onProgress || (() => {});
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    emit({ phase: 'fetching', message: 'Parsing PluralKit export file...' });

    // Validate PluralKit format
    if (!data.members && !data.name)
        throw new Error('This doesn\'t look like a PluralKit export file.');

    const memberCount = data.members?.length || 0;
    const groupCount = data.groups?.length || 0;
    const switchCount = data.switches?.length || 0;
    emit({ phase: 'fetching', message: `Found ${memberCount} member${memberCount !== 1 ? 's' : ''}, ${groupCount} group${groupCount !== 1 ? 's' : ''}, ${switchCount} switch${switchCount !== 1 ? 'es' : ''}. Starting import...` });

    const result = await processPluralKitData(system, user, {
        system: data,
        members: data.members || [],
        groups: data.groups || [],
        switches: data.switches || []
    }, options, onProgress);

    return result;
}

// ============================================
// PROCESS PLURALKIT DATA
// ============================================

async function processPluralKitData(system, user, data, options, onProgress) {
    const emit = onProgress || (() => {});
    const result = {
        systemUpdated: false,
        membersImported: 0,
        membersUpdated: 0,
        membersSkipped: 0,
        statesImported: 0,
        statesUpdated: 0,
        groupsImported: 0,
        groupsUpdated: 0,
        switchesImported: 0,
        pronounsApplied: false,
        errors: [],
        importedMembers: [],
        importedGroups: [],
        importedShifts: [],
    };

    const memberIdMap = new Map();

    // Update system info
    if (data.system) {
        if (data.system.name) {
            system.name = system.name || {};
            system.name.indexable = system.name.indexable || data.system.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || 'imported';
            system.name.display = data.system.name;
        }
        if (data.system.description) system.description = data.system.description;
        if (data.system.tag) {
            system.discord = system.discord || {};
            system.discord.tag = system.discord.tag || {};
            system.discord.tag.normal = [data.system.tag];
        }
        if (data.system.avatar_url) {
            if (options.target === TARGET_DISCORD) {
                system.discord = system.discord || {};
                system.discord.image = system.discord.image || {};
                const media = await syncImageToR2(data.system.avatar_url, system.users?.[0] || system.discordId, 'System', 'avatar');
                system.discord.image.avatar = media || { url: data.system.avatar_url };
            } else {
                const media = await syncImageToR2(data.system.avatar_url, system.users?.[0] || system.discordId, 'System', 'avatar');
                system.avatar = media || { url: data.system.avatar_url };
            }
        }
        if (data.system.color) {
            if (options.target === TARGET_DISCORD) {
                system.discord = system.discord || {};
                system.discord.color = `#${data.system.color}`;
            } else {
                system.color = `#${data.system.color}`;
            }
        }
        if (data.system.pronouns && options.applyPronouns && user) {
            user.pronouns = [data.system.pronouns];
            await user.save();
            result.pronounsApplied = true;
        }
        // Sync system banner
        if (data.system.banner_url) {
            if (options.target === TARGET_DISCORD) {
                system.discord = system.discord || {};
                system.discord.image = system.discord.image || {};
                const media = await syncImageToR2(data.system.banner_url, system.users?.[0] || system.discordId, 'System', 'banner');
                system.discord.image.banner = media || { url: data.system.banner_url };
            } else {
                const media = await syncImageToR2(data.system.banner_url, system.users?.[0] || system.discordId, 'System', 'banner');
                system.banner = media || { url: data.system.banner_url };
            }
        }
        // System metadata
        system.metadata = system.metadata || {};
        system.metadata.importedFrom = 'pluralkit';
        system.metadata.importedAt = new Date();
        system.metadata.sourceIds = system.metadata.sourceIds || {};
        system.metadata.sourceIds.pluralkit = data.system.id || undefined;
        if (data.system.created) system.metadata.sourceCreatedAt = new Date(data.system.created);
        result.systemUpdated = true;
    }

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.states) system.states = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // GROUPS FIRST: create/update groups, build membership map
    const groupMembershipMap = new Map();

    if (!options.noGroups && data.groups) {
        let groupIdx = 0;
        for (const pkGroup of (Array.isArray(data.groups) ? data.groups : [])) {
            groupIdx++;
            try {
                emit({ phase: 'groups', current: groupIdx, total: data.groups.length, entityName: pkGroup.display_name || pkGroup.name, message: `Importing group ${groupIdx}/${data.groups.length}: ${pkGroup.display_name || pkGroup.name}` });

                const existingGroup = await findExistingGroup(system, pkGroup);

                if (existingGroup && options.skipExisting) {
                    groupMembershipMap.set(existingGroup._id.toString(), (pkGroup.members || []).map(m => typeof m === 'string' ? m : m.id));
                    continue;
                }

                if (existingGroup && !options.replace) {
                    updateGroupFromPK(existingGroup, pkGroup);
                    await existingGroup.save();
                    groupMembershipMap.set(existingGroup._id.toString(), (pkGroup.members || []).map(m => typeof m === 'string' ? m : m.id));
                    result.groupsUpdated++;
                    result.importedGroups.push(existingGroup);
                } else {
                    const newGroup = createGroupFromPK(pkGroup);
                    await syncEntityImages(newGroup, pkGroup, 'Group', system, options.target, options.dryRun);
                    await utils.createAndLinkEntity(newGroup, system, 'group');
                    groupMembershipMap.set(newGroup._id.toString(), (pkGroup.members || []).map(m => typeof m === 'string' ? m : m.id));
                    result.groupsImported++;
                    result.importedGroups.push(newGroup);
                }
            } catch (err) {
                result.errors.push(`Group "${pkGroup.name}": ${err.message}`);
            }
        }
    }

    // MEMBERS: import as alters or states, link to groups
    let memberIdx = 0;
    for (const pkMember of (Array.isArray(data.members) ? data.members : [])) {
        memberIdx++;
        try {
            emit({ phase: 'members', current: memberIdx, total: data.members.length, entityName: pkMember.display_name || pkMember.name, message: `Importing member ${memberIdx}/${data.members.length}: ${pkMember.display_name || pkMember.name}` });

            if (!isMemberSelected(pkMember.id, options)) continue;

            const memberNameLower = pkMember.name.toLowerCase();
            const displayNameLower = (pkMember.display_name || '').toLowerCase();
            const shouldBeState = options.forceAsStates || options.stateNames?.some(sn =>
                sn === memberNameLower || sn === displayNameLower
            );

            let entity = null;
            let entityType = shouldBeState ? 'state' : 'alter';

            if (shouldBeState) {
                let existingState = await findExistingState(system, pkMember);

                if (existingState && options.skipExisting) {
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingState) {
                    // Update existing entity (both default merge and -replace)
                    await updateStateFromPK(existingState, pkMember, system, options.target);
                    await existingState.save();
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    entity = existingState;
                    result.statesUpdated++;
                    result.importedMembers.push(existingState);
                } else {
                    const newState = options.target === TARGET_DISCORD
                        ? createStateFromPKDiscord(pkMember)
                        : createStateFromPK(pkMember);
                    await filterConflictingProxies(newState, system);
                    await syncEntityImages(newState, pkMember, 'State', system, options.target, options.dryRun);
                    await utils.createAndLinkEntity(newState, system, 'state', options);
                    memberIdMap.set(pkMember.id, { id: newState._id, type: 'state' });
                    entity = newState;
                    result.statesImported++;
                    result.importedMembers.push(newState);
                }
            } else {
                let existingAlter = await findExistingAlter(system, pkMember);

                if (existingAlter && options.skipExisting) {
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingAlter) {
                    // Update existing entity (both default merge and -replace)
                    await updateAlterFromPK(existingAlter, pkMember, system, options.target);
                    await existingAlter.save();
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    entity = existingAlter;
                    result.membersUpdated++;
                    result.importedMembers.push(existingAlter);
                } else {
                    const newAlter = options.target === TARGET_DISCORD
                        ? createAlterFromPKDiscord(pkMember)
                        : createAlterFromPK(pkMember);
                    await filterConflictingProxies(newAlter, system);
                    await syncEntityImages(newAlter, pkMember, 'Alter', system, options.target, options.dryRun);
                    await utils.createAndLinkEntity(newAlter, system, 'alter', options);
                    memberIdMap.set(pkMember.id, { id: newAlter._id, type: 'alter' });
                    entity = newAlter;
                    result.membersImported++;
                    result.importedMembers.push(newAlter);
                }
            }

            // Link to groups
            if (entity) {
                for (const [groupId, sourceMemberIds] of groupMembershipMap) {
                    if (sourceMemberIds.includes(pkMember.id)) {
                        await utils.linkEntityToGroup(entity._id, groupId, entityType, options);
                    }
                }
            }
        } catch (err) {
            result.errors.push(`Member "${pkMember.name}": ${err.message}`);
        }
    }

    // Switches
    if (!options.noSwitches && data.switches && data.switches.length > 0) {
        emit({ phase: 'switches', current: 0, total: data.switches.length, message: `Importing ${data.switches.length} switch ${data.switches.length !== 1 ? 'entries' : 'entry'}...` });
        const switchResult = await importSwitches(system, data.switches, memberIdMap, options, onProgress);
        result.switchesImported = switchResult.count;
        if (switchResult.shifts?.length) result.importedShifts = switchResult.shifts;
    }

    emit({ phase: 'saving', message: 'Saving system...' });
    if (!options.dryRun) {
        await system.save();
    }

    // Normalize: convert Mongoose docs to plain objects with entityType tagged
    const stateIds = new Set((system.states?.IDs || []).map(id => id.toString()));
    result.importedMembers = result.importedMembers.map(m => {
        const plain = m.toJSON ? m.toJSON() : { ...m };
        plain.entityType = stateIds.has(m._id?.toString()) ? 'state' : 'alter';
        return plain;
    });
    result.importedGroups = result.importedGroups.map(g => g.toJSON ? g.toJSON() : { ...g });

    return result;
}

// ============================================
// FETCH HELPERS (for interactive states prompt)
// ============================================

async function fetchPKMembers(token) {
    const PKAPI = require('pkapi.js').default;
    const api = new PKAPI({ token, user_agent: 'Systemiser Discord Bot (import)' });
    return Array.from((await api.getMembers({ token })).values());
}

// ============================================
// SWITCH IMPORT (Phase 3)
// ============================================

async function importSwitches(system, pkSwitches, memberIdMap, options, onProgress) {
    const emit = onProgress || (() => {});
    const dryRun = options.dryRun || !system?._id;
    if (!system.front) system.front = {};
    if (!system.front.layers || system.front.layers.length === 0) {
        system.front.layers = [{
            _id: new mongoose.Types.ObjectId(),
            name: 'Main',
            shifts: []
        }];
    }

    const targetLayer = system.front.layers[0];

    // Sort ascending (oldest first) for proper start/end chaining
    const sorted = [...pkSwitches].sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    let imported = 0;
    for (let i = 0; i < sorted.length; i++) {
        const pkSwitch = sorted[i];
        emit({ phase: 'switches', current: i + 1, total: sorted.length, message: `Importing switch ${i + 1}/${sorted.length}...` });

        const memberIds = pkSwitch.members
            .map(m => {
                const mapped = memberIdMap.get(typeof m === 'string' ? m : m.id);
                return mapped ? mapped.id : null;
            })
            .filter(Boolean);

        if (memberIds.length === 0) continue;

        // Determine entity types for each member
        const members = [];
        for (const memberId of memberIds) {
            let s_type = 'alter';
            let type_name = 'Unknown';
            if (dryRun) {
                // In dryRun, entities aren't in MongoDB — use memberIdMap to determine type
                for (const [, mapped] of memberIdMap) {
                    if (mapped.id.toString() === memberId.toString()) {
                        s_type = mapped.type;
                        break;
                    }
                }
            } else {
                const alter = await Alter.findById(memberId);
                const state = alter ? null : await State.findById(memberId);
                s_type = alter ? 'alter' : 'state';
                type_name = (alter || state)?.name?.display || 'Unknown';
            }
            members.push({ s_type, ID: memberId, type_name });
        }

        const shiftId = new mongoose.Types.ObjectId();
        const shiftData = {
            _id: shiftId,
            s_type: 'alter',
            ID: dryRun ? shiftId : system._id,
            type_name: system.name?.display || 'System',
            startTime: new Date(pkSwitch.timestamp),
            endTime: i < sorted.length - 1
                ? new Date(sorted[i + 1].timestamp)
                : null,
            statuses: [{
                startTime: new Date(pkSwitch.timestamp),
                endTime: i < sorted.length - 1
                    ? new Date(sorted[i + 1].timestamp)
                    : null,
                layerID: targetLayer._id
            }]
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
// HELPER FUNCTIONS — FIND EXISTING
// ============================================

async function findExistingAlter(system, pkMember) {
    // Try by PK ID first
    let alter = await Alter.findOne({
        _id: { $in: system.alters?.IDs || [] },
        'metadata.pluralKitId': pkMember.id
    });
    if (alter) return alter;

    // Try by UUID
    alter = await Alter.findOne({
        _id: { $in: system.alters?.IDs || [] },
        'metadata.pluralKitUuid': pkMember.uuid
    });
    if (alter) return alter;

    // Try by name
    alter = await Alter.findOne({
        _id: { $in: system.alters?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(pkMember.name)}$`, 'i') }
    });

    return alter;
}

async function findExistingState(system, pkMember) {
    let state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'metadata.pluralKitId': pkMember.id
    });
    if (state) return state;

    state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'metadata.pluralKitUuid': pkMember.uuid
    });
    if (state) return state;

    state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(pkMember.name)}$`, 'i') }
    });

    return state;
}

async function findExistingGroup(system, pkGroup) {
    let group = await Group.findOne({
        _id: { $in: system.groups?.IDs || [] },
        'metadata.pluralKitId': pkGroup.id
    });
    if (group) return group;

    group = await Group.findOne({
        _id: { $in: system.groups?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(pkGroup.name)}$`, 'i') }
    });

    return group;
}

// ============================================
// HELPER FUNCTIONS — CREATE ENTITIES
// ============================================

function createAlterFromPK(pkMember) {
    const proxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    return new Alter({
        name: {
            indexable: pkMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`,
            display: pkMember.display_name || pkMember.name
        },
        description: pkMember.description || undefined,
        pronouns: pkMember.pronouns ? [pkMember.pronouns] : [],
        color: pkMember.color ? `#${pkMember.color}` : undefined,
        birthday: pkMember.birthday ? new Date(pkMember.birthday) : undefined,
        avatar: pkMember.avatar_url ? { url: pkMember.avatar_url } : undefined,
        banner: pkMember.banner_url ? { url: pkMember.banner_url } : undefined,
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid,
            sourceCreatedAt: pkMember.created ? new Date(pkMember.created) : undefined,
            sourceVisibility: pkMember.visibility || undefined,
            lastMessageTimestamp: pkMember.last_message_timestamp ? new Date(pkMember.last_message_timestamp) : undefined,
            messageCount: pkMember.message_count || 0,
        }
    });
}

function createAlterFromPKDiscord(pkMember) {
    const proxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    return new Alter({
        name: {
            indexable: pkMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`
        },
        discord: {
            name: {
                display: pkMember.display_name || pkMember.name
            },
            description: pkMember.description || undefined,
            color: pkMember.color ? `#${pkMember.color}` : undefined,
            image: {
                avatar: pkMember.avatar_url ? { url: pkMember.avatar_url } : undefined,
                banner: pkMember.banner_url ? { url: pkMember.banner_url } : undefined
            }
        },
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid,
            sourceCreatedAt: pkMember.created ? new Date(pkMember.created) : undefined,
            sourceVisibility: pkMember.visibility || undefined,
            lastMessageTimestamp: pkMember.last_message_timestamp ? new Date(pkMember.last_message_timestamp) : undefined,
            messageCount: pkMember.message_count || 0,
        }
    });
}

function createStateFromPK(pkMember) {
    const proxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    return new State({
        name: {
            indexable: pkMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `state${Date.now()}`,
            display: pkMember.display_name || pkMember.name
        },
        description: pkMember.description || undefined,
        pronouns: pkMember.pronouns ? [pkMember.pronouns] : [],
        color: pkMember.color ? `#${pkMember.color}` : undefined,
        avatar: pkMember.avatar_url ? { url: pkMember.avatar_url } : undefined,
        banner: pkMember.banner_url ? { url: pkMember.banner_url } : undefined,
        proxy: proxies,
        groupsIDs: [],
        alterIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid,
            sourceCreatedAt: pkMember.created ? new Date(pkMember.created) : undefined,
            sourceVisibility: pkMember.visibility || undefined,
            lastMessageTimestamp: pkMember.last_message_timestamp ? new Date(pkMember.last_message_timestamp) : undefined,
            messageCount: pkMember.message_count || 0,
        }
    });
}

function createStateFromPKDiscord(pkMember) {
    const proxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    return new State({
        name: {
            indexable: pkMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `state${Date.now()}`
        },
        discord: {
            name: {
                display: pkMember.display_name || pkMember.name
            },
            description: pkMember.description || undefined,
            color: pkMember.color ? `#${pkMember.color}` : undefined,
            image: {
                avatar: pkMember.avatar_url ? { url: pkMember.avatar_url } : undefined,
                banner: pkMember.banner_url ? { url: pkMember.banner_url } : undefined
            }
        },
        proxy: proxies,
        groupsIDs: [],
        alterIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid,
            sourceCreatedAt: pkMember.created ? new Date(pkMember.created) : undefined,
            sourceVisibility: pkMember.visibility || undefined,
            lastMessageTimestamp: pkMember.last_message_timestamp ? new Date(pkMember.last_message_timestamp) : undefined,
            messageCount: pkMember.message_count || 0,
        }
    });
}

function createGroupFromPK(pkGroup) {
    return new Group({
        name: {
            indexable: pkGroup.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
            display: pkGroup.display_name || pkGroup.name
        },
        description: pkGroup.description || undefined,
        color: pkGroup.color ? `#${pkGroup.color}` : undefined,
        avatar: pkGroup.icon ? { url: pkGroup.icon } : undefined,
        banner: pkGroup.banner_url ? { url: pkGroup.banner_url } : undefined,
        alterIDs: [],
        stateIDs: [],
        metadata: {
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkGroup.id,
            pluralKitUuid: pkGroup.uuid
        }
    });
}

// ============================================
// HELPER FUNCTIONS — UPDATE ENTITIES
// ============================================

async function updateAlterFromPK(alter, pkMember, system, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        if (!alter.discord) alter.discord = {};
        if (!alter.discord.name) alter.discord.name = {};
        if (!alter.discord.image) alter.discord.image = {};

        if (pkMember.display_name) alter.discord.name.display = pkMember.display_name;
        if (pkMember.description) alter.discord.description = pkMember.description;
        if (pkMember.color) alter.discord.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) alter.discord.image.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner) alter.discord.image.banner = { url: pkMember.banner };
    } else {
        if (pkMember.display_name) alter.name.display = pkMember.display_name;
        if (pkMember.description) alter.description = pkMember.description;
        if (pkMember.pronouns) alter.pronouns = [pkMember.pronouns];
        if (pkMember.color) alter.color = `#${pkMember.color}`;
        if (pkMember.birthday) alter.birthday = new Date(pkMember.birthday);
        if (pkMember.avatar_url) alter.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner_url) alter.banner = { url: pkMember.banner_url };
    }

    // Proxy tags always go to main proxy field
    const newProxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    for (const proxy of newProxies) {
        if (!alter.proxy?.includes(proxy)) {
            const { exists } = await checkProxyExists(proxy, system, alter._id.toString());
            if (!exists) {
                alter.proxy = alter.proxy || [];
                alter.proxy.push(proxy);
            }
        }
    }

    alter.metadata = alter.metadata || {};
    alter.metadata.pluralKitId = pkMember.id;
    alter.metadata.pluralKitUuid = pkMember.uuid;
}

async function updateStateFromPK(state, pkMember, system, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        if (!state.discord) state.discord = {};
        if (!state.discord.name) state.discord.name = {};
        if (!state.discord.image) state.discord.image = {};

        if (pkMember.display_name) state.discord.name.display = pkMember.display_name;
        if (pkMember.description) state.discord.description = pkMember.description;
        if (pkMember.color) state.discord.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) state.discord.image.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner) state.discord.image.banner = { url: pkMember.banner };
    } else {
        if (pkMember.display_name) state.name.display = pkMember.display_name;
        if (pkMember.description) state.description = pkMember.description;
        if (pkMember.pronouns) state.pronouns = [pkMember.pronouns];
        if (pkMember.color) state.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) state.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner_url) state.banner = { url: pkMember.banner_url };
    }

    const newProxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    for (const proxy of newProxies) {
        if (!state.proxy?.includes(proxy)) {
            const { exists } = await checkProxyExists(proxy, system, state._id.toString());
            if (!exists) {
                state.proxy = state.proxy || [];
                state.proxy.push(proxy);
            }
        }
    }

    state.metadata = state.metadata || {};
    state.metadata.pluralKitId = pkMember.id;
    state.metadata.pluralKitUuid = pkMember.uuid;
}

function updateGroupFromPK(group, pkGroup) {
    if (pkGroup.display_name) group.name.display = pkGroup.display_name;
    if (pkGroup.description) group.description = pkGroup.description;
    if (pkGroup.color) group.color = `#${pkGroup.color}`;
    if (pkGroup.icon) group.avatar = { url: pkGroup.icon };
    if (pkGroup.banner_url) group.banner = { url: pkGroup.banner_url };

    group.metadata = group.metadata || {};
    group.metadata.pluralKitId = pkGroup.id;
    group.metadata.pluralKitUuid = pkGroup.uuid;
}

// ============================================
// PREVIEW FUNCTIONS (fetch without writing)
// ============================================

async function previewPluralKitData(system, data) {
    const members = [];
    for (const pkMember of (Array.isArray(data.members) ? data.members : [])) {
        const existingAlter = await findExistingAlter(system, pkMember);
        const existingState = await findExistingState(system, pkMember);
        const existing = existingAlter || existingState;

        members.push({
            sourceId: pkMember.id,
            name: pkMember.display_name || pkMember.name,
            avatar: pkMember.avatar_url || null,
            description: pkMember.description || null,
            pronouns: pkMember.pronouns || null,
            color: pkMember.color ? `#${pkMember.color}` : null,
            proxy: (pkMember.proxy_tags || []).map(t => `${t.prefix || ''}text${t.suffix || ''}`).filter(p => p !== 'text'),
            action: existing ? 'update' : 'new',
            existingId: existing?._id?.toString() || null,
            visibility: pkMember.visibility || 'public',
            banner: pkMember.banner_url || null,
        });
    }

    const groups = [];
    for (const pkGroup of (Array.isArray(data.groups) ? data.groups : [])) {
        const existingGroup = await findExistingGroup(system, pkGroup);
        groups.push({
            sourceId: pkGroup.id,
            name: pkGroup.display_name || pkGroup.name,
            description: pkGroup.description || null,
            color: pkGroup.color ? `#${pkGroup.color}` : null,
            memberSourceIds: (pkGroup.members || []).map(m => typeof m === 'string' ? m : m.id),
            action: existingGroup ? 'update' : 'new',
            existingId: existingGroup?._id?.toString() || null,
            visibility: pkGroup.visibility || 'public',
            banner: pkGroup.banner_url || null,
        });
    }

    return { members, groups };
}

async function previewPluralKitAPI(system, token) {
    const PKAPI = require('pkapi.js').default;
    const api = new PKAPI({ token, user_agent: 'Systemiser Discord Bot (import)' });

    const pkSystem = await api.getSystem({ token });
    const pkMembers = Array.from((await api.getMembers({ token })).values());
    let pkGroups = [];
    try {
        const raw = await api.getGroups({ token });
        pkGroups = raw instanceof Map ? Array.from(raw.values()) : (Array.isArray(raw) ? raw : []);
    } catch {}

    const preview = await previewPluralKitData(system, {
        system: pkSystem, members: pkMembers, groups: pkGroups
    });

    return preview;
}

async function previewPluralKitFile(system, fileData) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;
    if (!data.members && !data.name) throw new Error('Not a PluralKit export file.');

    const preview = await previewPluralKitData(system, {
        system: data, members: data.members || [], groups: data.groups || []
    });

    return preview;
}

module.exports = {
    parsePluralKitUrl,
    importPluralKitAPI,
    importPluralKitFile,
    processPluralKitData,
    fetchPKMembers,
    importSwitches,
    findExistingAlter,
    findExistingState,
    findExistingGroup,
    createAlterFromPK,
    createAlterFromPKDiscord,
    createStateFromPK,
    createStateFromPKDiscord,
    createGroupFromPK,
    updateAlterFromPK,
    updateStateFromPK,
    updateGroupFromPK,
    previewPluralKitData,
    previewPluralKitAPI,
    previewPluralKitFile,
};
