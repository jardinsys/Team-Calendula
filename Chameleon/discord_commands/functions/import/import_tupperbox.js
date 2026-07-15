// Tupperbox-specific import functions
// Extracted from import_functions.js — Tupperbox file import, data processing, preview

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const { mergeEntityData, isCrossSourceMatch } = require('./crossSourceMerge');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const Group = require('../../../schemas/group');
const { checkProxyExists } = require('../bot_utils');
const utils = require('../bot_utils');
const { syncEntityImages, filterConflictingProxies, isMemberSelected } = require('./helpers');
const { TARGET_APP, TARGET_DISCORD } = require('./constants');

// ============================================
// HELPER FUNCTIONS — TUPPERBOX / MISC
// ============================================

function convertTBBracketsToProxy(brackets) {
    if (!brackets || brackets.length < 2) return null;
    const prefix = brackets[0] || '';
    const suffix = brackets[1] || '';
    if (!prefix && !suffix) return null;
    return `${prefix}text${suffix}`;
}

// ============================================
// TUPPERBOX FILE IMPORT
// ============================================

async function importTupperboxFile(system, user, fileData, options, onProgress) {
    const emit = onProgress || (() => {});
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    emit({ phase: 'fetching', message: 'Parsing Tupperbox export file...' });

    if (!data.tuppers)
        throw new Error('This doesn\'t look like a Tupperbox export file.');

    const tupperCount = data.tuppers?.length || 0;
    const groupCount = data.groups?.length || 0;
    emit({ phase: 'fetching', message: `Found ${tupperCount} tupper${tupperCount !== 1 ? 's' : ''}, ${groupCount} group${groupCount !== 1 ? 's' : ''}. Starting import...` });

    const result = await processTupperboxData(system, data, options, onProgress);
    return result;
}

async function processTupperboxData(system, data, options, onProgress) {
    const emit = onProgress || (() => {});
    const result = {
        systemUpdated: false,
        membersImported: 0,
        membersUpdated: 0,
        membersSkipped: 0,
        groupsImported: 0,
        groupsUpdated: 0,
        switchesImported: 0,
        errors: [],
        importedMembers: [],
        importedGroups: []
    };

    const groupIdMap = new Map();

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // System metadata
    system.metadata = system.metadata || {};
    system.metadata.importedFrom = 'tupperbox';
    system.metadata.importedAt = new Date();

    // Import groups first (if present)
    if (!options.noGroups && Array.isArray(data.groups)) {
        let groupIdx = 0;
        for (const tbGroup of data.groups) {
            groupIdx++;
            try {
                emit({ phase: 'groups', current: groupIdx, total: data.groups.length, entityName: tbGroup.name, message: `Importing group ${groupIdx}/${data.groups.length}: ${tbGroup.name}` });
                let existingGroup = await Group.findOne({
                    _id: { $in: system.groups.IDs || [] },
                    'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tbGroup.name)}$`, 'i') }
                });

                if (existingGroup && options.skipExisting) {
                    groupIdMap.set(tbGroup.id, existingGroup._id);
                    continue;
                }

                if (existingGroup) {
                    if (tbGroup.description) existingGroup.description = tbGroup.description;
                    if (tbGroup.color) existingGroup.color = tbGroup.color;
                    if (tbGroup.tag) existingGroup.signoff = tbGroup.tag;
                    await existingGroup.save();
                    groupIdMap.set(tbGroup.id, existingGroup._id);
                    result.groupsUpdated++;
                    result.importedGroups.push(existingGroup);
                } else {
                    const newGroup = new Group({
                        name: {
                            indexable: tbGroup.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
                            display: tbGroup.name
                        },
                        description: tbGroup.description || undefined,
                        color: tbGroup.color || undefined,
                        avatar: tbGroup.icon ? { url: tbGroup.icon } : undefined,
                        signoff: tbGroup.tag || undefined,
                        alterIDs: [],
                        metadata: {
                            importedFrom: 'tupperbox',
                            importedAt: new Date()
                        }
                    });
                    await syncEntityImages(newGroup, tbGroup, 'Group', system, options.target, options.dryRun);
                    await utils.createAndLinkEntity(newGroup, system, 'group', options);

                    groupIdMap.set(tbGroup.id, newGroup._id);
                    result.groupsImported++;
                    result.importedGroups.push(newGroup);
                }
            } catch (err) {
                result.errors.push(`Group "${tbGroup.name}": ${err.message}`);
            }
        }
    }

    // Import tuppers as alters
    let tupperIdx = 0;
    for (const tupper of (Array.isArray(data.tuppers) ? data.tuppers : [])) {
        tupperIdx++;
        try {
            emit({ phase: 'members', current: tupperIdx, total: data.tuppers.length, entityName: tupper.name, message: `Importing tupper ${tupperIdx}/${data.tuppers.length}: ${tupper.name}` });

            if (!isMemberSelected(tupper.name, options)) continue;

            // During registration (no system._id), search for entities without a systemID
            // During normal import, search within the system's entity IDs
            const alterQuery = system._id
                ? { _id: { $in: system.alters?.IDs || [] }, 'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tupper.name)}$`, 'i') } }
                : { systemID: { $exists: false }, 'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tupper.name)}$`, 'i') } };
            let existingAlter = await Alter.findOne(alterQuery);

            if (existingAlter && options.skipExisting) {
                // Cross-source match: merge instead of skip
                if (!isCrossSourceMatch(existingAlter, 'tupperbox')) {
                    result.membersSkipped++;
                    continue;
                }
                // Fall through to merge below
            }

            const proxy = convertTBBracketsToProxy(tupper.brackets);

            if (existingAlter) {
                // Cross-source merge: only set fields that are empty
                mergeEntityData(existingAlter, {
                    avatar: tupper.avatar_url ? { url: tupper.avatar_url } : undefined,
                    description: tupper.description || undefined,
                }, 'tupperbox', {});

                // TupperBox-specific: add nick as alias (always, since it's additive)
                if (tupper.nick) {
                    existingAlter.name.aliases = existingAlter.name.aliases || [];
                    if (!existingAlter.name.aliases.includes(tupper.nick)) {
                        existingAlter.name.aliases.push(tupper.nick);
                    }
                }

                // Proxy tags: append unique (always, since it's additive)
                if (proxy && !existingAlter.proxy?.includes(proxy)) {
                    const { exists } = await checkProxyExists(proxy, system, existingAlter._id.toString());
                    if (!exists) {
                        existingAlter.proxy = existingAlter.proxy || [];
                        existingAlter.proxy.push(proxy);
                    }
                }

                // Signoff: only set if empty
                if (tupper.tag && !existingAlter.signoff) existingAlter.signoff = tupper.tag;

                // Ensure TupperBox metadata is set
                if (!existingAlter.metadata) existingAlter.metadata = {};

                await existingAlter.save();

                if (tupper.group_id && groupIdMap.has(tupper.group_id)) {
                    await utils.linkEntityToGroup(existingAlter._id, groupIdMap.get(tupper.group_id), 'alter', options);
                }

                result.membersUpdated++;
                result.importedMembers.push(existingAlter);
            } else {
                // Check if proxy conflicts with existing entities
                let proxyBlocked = false;
                if (proxy) {
                    const { exists } = await checkProxyExists(proxy, system);
                    if (exists) proxyBlocked = true;
                }

                const newAlter = new Alter({
                    name: {
                        indexable: tupper.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`,
                        display: tupper.name,
                        aliases: tupper.nick ? [tupper.nick] : []
                    },
                    avatar: tupper.avatar_url ? { url: tupper.avatar_url } : undefined,
                    description: tupper.description || undefined,
                    proxy: (proxy && !proxyBlocked) ? [proxy] : [],
                    signoff: tupper.tag || undefined,
                    groupsIDs: [],
                    metadata: {
                        importedFrom: 'tupperbox',
                        importedAt: new Date(),
                        sourceCreatedAt: tupper.created ? new Date(tupper.created) : undefined,
                    }
                });
                await syncEntityImages(newAlter, tupper, 'Alter', system, options.target, options.dryRun);
                await utils.createAndLinkEntity(newAlter, system, 'alter', options);

                if (tupper.group_id && groupIdMap.has(tupper.group_id)) {
                    await utils.linkEntityToGroup(newAlter._id, groupIdMap.get(tupper.group_id), 'alter', options);
                }

                result.membersImported++;
                result.importedMembers.push(newAlter);
            }
        } catch (err) {
            result.errors.push(`Tupper "${tupper.name}": ${err.message}`);
        }
    }

    emit({ phase: 'saving', message: 'Saving system...' });
    if (!options.dryRun) await system.save();

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
// PREVIEW FUNCTIONS (fetch without writing)
// ============================================

async function previewTupperboxData(system, data) {
    const members = [];
    for (const tupper of (Array.isArray(data.tuppers) ? data.tuppers : [])) {
        let existingAlter = null;
        try {
            existingAlter = await Alter.findOne({
                _id: { $in: system.alters?.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tupper.name)}$`, 'i') }
            });
        } catch {}

        const proxy = convertTBBracketsToProxy(tupper.brackets);

        members.push({
            sourceId: tupper.name,
            name: tupper.name,
            aliases: tupper.nick ? [tupper.nick] : [],
            avatar: tupper.avatar_url || null,
            description: tupper.description || null,
            pronouns: null,
            color: null,
            proxy: proxy ? [proxy] : [],
            groupSourceId: tupper.group_id || null,
            action: existingAlter ? 'update' : 'new',
            existingId: existingAlter?._id?.toString() || null,
            visibility: 'public',
        });
    }

    const groups = [];
    for (const tbGroup of (Array.isArray(data.groups) ? data.groups : [])) {
        let existingGroup = null;
        try {
            existingGroup = await Group.findOne({
                _id: { $in: system.groups?.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tbGroup.name)}$`, 'i') }
            });
        } catch {}

        const memberSourceIds = (data.tuppers || [])
            .filter(t => t.group_id === tbGroup.id)
            .map(t => t.name);

        groups.push({
            sourceId: tbGroup.id,
            name: tbGroup.name,
            description: null,
            color: null,
            memberSourceIds,
            action: existingGroup ? 'update' : 'new',
            existingId: existingGroup?._id?.toString() || null,
            visibility: 'public',
        });
    }

    return { members, groups };
}

async function previewTupperboxFile(system, fileData) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;
    if (!data.tuppers) throw new Error('Not a Tupperbox export file.');

    return await previewTupperboxData(system, data);
}

module.exports = {
    convertTBBracketsToProxy,
    importTupperboxFile,
    processTupperboxData,
    previewTupperboxData,
    previewTupperboxFile,
};
