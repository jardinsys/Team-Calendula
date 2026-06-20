// Octocon import functions
// Extracted from import_functions.js — all Octocon-specific logic

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
const utils = require('../bot_utils');
const { checkProxyExists } = require('../bot_utils');
const { syncEntityImages, filterConflictingProxies, isMemberSelected } = require('./helpers');
const { TARGET_APP, TARGET_DISCORD, OCTOCON_API_BASE } = require('./constants');

// ============================================
// OCTOCON ID PARSING
// ============================================

function parseOctoconId(input) {
    if (!input) return null;

    // URL format: octocon.app/u/abcdefg or octocon.app/systems/abcdefg
    const urlMatch = input.match(/octocon\.app\/(?:u|systems)\/([a-z0-9]{7})/i);
    if (urlMatch) return urlMatch[1].toLowerCase();

    // Short ID: 7 lowercase alphanumeric chars
    if (/^[a-z0-9]{7}$/.test(input)) return input.toLowerCase();

    return null;
}

// ============================================
// OCTOCON API IMPORT
// ============================================

async function importOctoconAPI(system, user, systemId, options, onProgress) {
    const emit = onProgress || (() => {});

    emit({ phase: 'fetching', message: 'Connecting to Octocon API...' });

    // Fetch system info
    const systemResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}`);
    if (!systemResponse.ok) {
        if (systemResponse.status === 404) throw new Error('System not found. Check your Octocon system ID (7 characters, e.g. `abcdefg`).');
        throw new Error(`Octocon API error: ${systemResponse.status}`);
    }
    const systemData = await systemResponse.json();

    emit({ phase: 'fetching', message: 'Fetching alters...' });

    // Fetch alters
    const altersResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/alters`);
    if (!altersResponse.ok) throw new Error(`Octocon API error (alters): ${altersResponse.status}`);
    const altersData = await altersResponse.json();

    emit({ phase: 'fetching', message: `Found ${altersData.length} alter${altersData.length !== 1 ? 's' : ''}. Fetching tags...` });

    // Fetch tags (groups equivalent)
    let tagsData = [];
    if (!options.noGroups) {
        const tagsResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/tags`);
        if (tagsResponse.ok) tagsData = await tagsResponse.json();
    }

    emit({ phase: 'fetching', message: `Found ${tagsData.length} tag${tagsData.length !== 1 ? 's' : ''}. Fetching front history...` });

    // Fetch front entries
    let frontData = [];
    if (!options.noSwitches) {
        const frontResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/fronting`);
        if (frontResponse.ok) frontData = await frontResponse.json();
    }

    emit({ phase: 'fetching', message: `Found ${frontData.length} front entry${frontData.length !== 1 ? 's' : ''}. Starting import...` });

    const result = await processOctoconData(system, user, {
        user: systemData,
        alters: altersData,
        tags: tagsData,
        fronts: frontData
    }, options, onProgress);

    return result;
}

// ============================================
// OCTOCON FILE IMPORT
// ============================================

async function importOctoconFile(system, user, fileData, options, onProgress) {
    const emit = onProgress || (() => {});
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    emit({ phase: 'fetching', message: 'Parsing Octocon export file...' });

    if (!data.user || !data.alters)
        throw new Error('This doesn\'t look like an Octocon export file.');

    const alterCount = data.alters?.length || 0;
    const tagCount = data.tags?.length || 0;
    const frontCount = data.fronts?.length || 0;
    emit({ phase: 'fetching', message: `Found ${alterCount} alter${alterCount !== 1 ? 's' : ''}, ${tagCount} tag${tagCount !== 1 ? 's' : ''}, ${frontCount} front ${frontCount !== 1 ? 'entries' : 'entry'}. Starting import...` });

    const result = await processOctoconData(system, user, data, options, onProgress);
    return result;
}

// ============================================
// PROCESS OCTOCON DATA
// ============================================

async function processOctoconData(system, user, data, options, onProgress) {
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
        errors: []
    };

    const alterIdMap = new Map();

    // Update system info
    if (data.user) {
        if (data.user.username) {
            system.name = system.name || {};
            system.name.indexable = system.name.indexable || data.user.username.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || 'imported';
            system.name.display = data.user.username;
        }
        if (data.user.description) system.description = data.user.description;
        if (data.user.avatar_url) {
            if (options.target === TARGET_DISCORD) {
                system.discord = system.discord || {};
                system.discord.image = system.discord.image || {};
                const media = await syncImageToR2(data.user.avatar_url, system.users[0] || system.discordId, 'System', 'avatar');
                system.discord.image.avatar = media || { url: data.user.avatar_url };
            } else {
                const media = await syncImageToR2(data.user.avatar_url, system.users[0] || system.discordId, 'System', 'avatar');
                system.avatar = media || { url: data.user.avatar_url };
            }
        }
        if (data.user.fields) {
            for (const field of data.user.fields) {
                if (field.name?.toLowerCase() === 'pronouns' && field.value && options.applyPronouns && user) {
                    user.pronouns = [field.value];
                    await user.save();
                    result.pronounsApplied = true;
                }
            }
        }
        // Sync system banner (Octocon)
        if (data.user.bannerUrl) {
            if (options.target === TARGET_DISCORD) {
                system.discord = system.discord || {};
                system.discord.image = system.discord.image || {};
                const media = await syncImageToR2(data.user.bannerUrl, system.users[0] || system.discordId, 'System', 'banner');
                system.discord.image.banner = media || { url: data.user.bannerUrl };
            } else {
                const media = await syncImageToR2(data.user.bannerUrl, system.users[0] || system.discordId, 'System', 'banner');
                system.banner = media || { url: data.user.bannerUrl };
            }
        }
        result.systemUpdated = true;
    }

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.states) system.states = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // GROUPS FIRST: create/update tags as groups, build membership map
    const groupMembershipMap = new Map();

    if (!options.noGroups && data.tags) {
        let tagIdx = 0;
        for (const tag of data.tags) {
            tagIdx++;
            try {
                emit({ phase: 'groups', current: tagIdx, total: data.tags.length, entityName: tag.name, message: `Importing group ${tagIdx}/${data.tags.length}: ${tag.name}` });

                const existingGroup = await findExistingGroupOctocon(system, tag);

                if (existingGroup && options.skipExisting) {
                    groupMembershipMap.set(existingGroup._id.toString(), tag.alters || []);
                    continue;
                }

                if (existingGroup && !options.replace) {
                    updateGroupFromOctocon(existingGroup, tag);
                                        await existingGroup.save();
                    groupMembershipMap.set(existingGroup._id.toString(), tag.alters || []);
                    result.groupsUpdated++;
                } else {
                    const newGroup = createGroupFromOctocon(tag);
                    await syncEntityImages(newGroup, tag, 'Group', system, options.target);
                    await utils.createAndLinkEntity(newGroup, system, 'group');
                    groupMembershipMap.set(newGroup._id.toString(), tag.alters || []);
                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Tag "${tag.name}": ${err.message}`);
            }
        }
    }

    // ALTERS: import as alters or states, link to groups
    let alterIdx = 0;
    for (const octoAlter of (data.alters || [])) {
        alterIdx++;
        try {
            emit({ phase: 'members', current: alterIdx, total: (data.alters || []).length, entityName: octoAlter.name, message: `Importing alter ${alterIdx}/${(data.alters || []).length}: ${octoAlter.name}` });

            if (!isMemberSelected(octoAlter.id, options)) continue;

            const alterNameLower = octoAlter.name?.toLowerCase();
            const shouldBeState = options.forceAsStates || options.stateNames?.some(sn => sn === alterNameLower);

            let entity = null;
            let entityType = shouldBeState ? 'state' : 'alter';

            if (shouldBeState) {
                let existingState = await findExistingStateOctocon(system, octoAlter);

                if (existingState && options.skipExisting) {
                    alterIdMap.set(octoAlter.id, { id: existingState._id, type: 'state' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingState && !options.replace) {
                    await updateStateFromOctocon(existingState, octoAlter, system, options.target);
                                        await existingState.save();
                    alterIdMap.set(octoAlter.id, { id: existingState._id, type: 'state' });
                    entity = existingState;
                    result.statesUpdated++;
                } else {
                    const newState = options.target === TARGET_DISCORD
                        ? createStateFromOctoconDiscord(octoAlter)
                        : createStateFromOctocon(octoAlter);
                    await filterConflictingProxies(newState, system);
                    await syncEntityImages(newState, octoAlter, 'State', system, options.target);
                    await utils.createAndLinkEntity(newState, system, 'state');
                    alterIdMap.set(octoAlter.id, { id: newState._id, type: 'state' });
                    entity = newState;
                    result.statesImported++;
                }
            } else {
                let existingAlter = await findExistingAlterOctocon(system, octoAlter);

                if (existingAlter && options.skipExisting) {
                    alterIdMap.set(octoAlter.id, { id: existingAlter._id, type: 'alter' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingAlter && !options.replace) {
                    await updateAlterFromOctocon(existingAlter, octoAlter, system, options.target);
                                        await existingAlter.save();
                    alterIdMap.set(octoAlter.id, { id: existingAlter._id, type: 'alter' });
                    entity = existingAlter;
                    result.membersUpdated++;
                } else {
                    const newAlter = options.target === TARGET_DISCORD
                        ? createAlterFromOctoconDiscord(octoAlter)
                        : createAlterFromOctocon(octoAlter);
                    await filterConflictingProxies(newAlter, system);
                    await syncEntityImages(newAlter, octoAlter, 'Alter', system, options.target);
                    await utils.createAndLinkEntity(newAlter, system, 'alter');
                    alterIdMap.set(octoAlter.id, { id: newAlter._id, type: 'alter' });
                    entity = newAlter;
                    result.membersImported++;
                }
            }

            // Link to groups
            if (entity) {
                for (const [groupId, sourceAlterIds] of groupMembershipMap) {
                    if (sourceAlterIds.includes(octoAlter.id)) {
                        await utils.linkEntityToGroup(entity._id, groupId, entityType);
                    }
                }
            }
        } catch (err) {
            result.errors.push(`Alter "${octoAlter.name}": ${err.message}`);
        }
    }

    // Fronts
    if (!options.noSwitches && data.fronts && data.fronts.length > 0) {
        emit({ phase: 'switches', current: 0, total: data.fronts.length, message: `Importing ${data.fronts.length} front ${data.fronts.length !== 1 ? 'entries' : 'entry'}...` });
        const importedShifts = await importOctoconFronts(system, data.fronts, alterIdMap, options);
        result.switchesImported = importedShifts;
    }

    emit({ phase: 'saving', message: 'Saving system...' });
    await system.save();
    return result;
}

// ============================================
// OCTOCON FRONT IMPORT
// ============================================

async function importOctoconFronts(system, fronts, alterIdMap, options, onProgress) {
    const emit = onProgress || (() => {});
    if (!system.front) system.front = {};
    if (!system.front.layers || system.front.layers.length === 0) {
        system.front.layers = [{
            _id: new mongoose.Types.ObjectId(),
            name: 'Main',
            shifts: []
        }];
    }

    const targetLayer = system.front.layers[0];

    // Sort ascending (oldest first)
    const sorted = [...fronts].sort((a, b) =>
        new Date(a.time_start) - new Date(b.time_start)
    );

    // Group fronts by time ranges (overlapping = co-fronting)
    const groups = [];
    let currentGroup = null;

    for (const front of sorted) {
        const startTime = new Date(front.time_start);
        const endTime = front.time_end ? new Date(front.time_end) : null;

        if (!currentGroup || (currentGroup.endTime && startTime > currentGroup.endTime)) {
            // Start a new group
            if (currentGroup) groups.push(currentGroup);
            currentGroup = {
                startTime,
                endTime,
                alterIds: [front.alter_id]
            };
        } else {
            // Overlapping — extend end time and add alter
            if (endTime && (!currentGroup.endTime || endTime > currentGroup.endTime)) {
                currentGroup.endTime = endTime;
            }
            if (!currentGroup.alterIds.includes(front.alter_id)) {
                currentGroup.alterIds.push(front.alter_id);
            }
        }
    }
    if (currentGroup) groups.push(currentGroup);

    let imported = 0;

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        emit({ phase: 'switches', current: i + 1, total: groups.length, message: `Importing front entry ${i + 1}/${groups.length}...` });

        const members = [];
        for (const alterId of group.alterIds) {
            const mapped = alterIdMap.get(alterId);
            if (!mapped) continue;

            const alter = await Alter.findById(mapped.id);
            const state = alter ? null : await State.findById(mapped.id);
            members.push({
                s_type: alter ? 'alter' : 'state',
                ID: mapped.id,
                type_name: (alter || state)?.name?.display || 'Unknown'
            });
        }

        if (members.length === 0) continue;

        for (const member of members) {
            const shift = new Shift({
                s_type: member.s_type,
                ID: member.ID,
                type_name: member.type_name,
                startTime: group.startTime,
                endTime: group.endTime,
                statuses: [{
                    startTime: group.startTime,
                    endTime: group.endTime,
                    layerID: targetLayer._id
                }]
            });

            await shift.save();
            targetLayer.shifts.push(shift._id);
        }
        imported++;
    }

    await system.save();
    return imported;
}

// ============================================
// HELPER FUNCTIONS — FIND EXISTING (Octocon)
// ============================================

async function findExistingAlterOctocon(system, octoAlter) {
    // Try by Octocon ID
    let alter = await Alter.findOne({
        _id: { $in: system.alters?.IDs || [] },
        'metadata.octoconId': octoAlter.id
    });
    if (alter) return alter;

    // Try by name
    alter = await Alter.findOne({
        _id: { $in: system.alters?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(octoAlter.name)}$`, 'i') }
    });

    return alter;
}

async function findExistingStateOctocon(system, octoAlter) {
    let state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'metadata.octoconId': octoAlter.id
    });
    if (state) return state;

    state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(octoAlter.name)}$`, 'i') }
    });

    return state;
}

async function findExistingGroupOctocon(system, tag) {
    let group = await Group.findOne({
        _id: { $in: system.groups?.IDs || [] },
        'metadata.octoconTagId': tag.id
    });
    if (group) return group;

    group = await Group.findOne({
        _id: { $in: system.groups?.IDs || [] },
        'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tag.name)}$`, 'i') }
    });

    return group;
}

// ============================================
// HELPER FUNCTIONS — CREATE ENTITIES (Octocon)
// ============================================

function createAlterFromOctocon(octoAlter) {
    // Octocon discord_proxies[] uses the same format as Systemiser proxy[]
    const proxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);

    return new Alter({
        name: {
            indexable: octoAlter.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`,
            display: octoAlter.name || 'Unknown'
        },
        description: octoAlter.description || undefined,
        pronouns: octoAlter.pronouns ? [octoAlter.pronouns] : [],
        color: octoAlter.color || undefined,
        avatar: octoAlter.avatar_url ? { url: octoAlter.avatar_url } : undefined,
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            importedFrom: 'octocon',
            importedAt: new Date(),
            octoconId: octoAlter.id
        }
    });
}

function createAlterFromOctoconDiscord(octoAlter) {
    const proxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);

    return new Alter({
        name: {
            indexable: octoAlter.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`
        },
        discord: {
            name: {
                display: octoAlter.name || 'Unknown'
            },
            description: octoAlter.description || undefined,
            color: octoAlter.color || undefined,
            image: {
                avatar: octoAlter.avatar_url ? { url: octoAlter.avatar_url } : undefined
            }
        },
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            importedFrom: 'octocon',
            importedAt: new Date(),
            octoconId: octoAlter.id
        }
    });
}

function createStateFromOctocon(octoAlter) {
    const proxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);

    return new State({
        name: {
            indexable: octoAlter.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `state${Date.now()}`,
            display: octoAlter.name || 'Unknown'
        },
        description: octoAlter.description || undefined,
        pronouns: octoAlter.pronouns ? [octoAlter.pronouns] : [],
        color: octoAlter.color || undefined,
        avatar: octoAlter.avatar_url ? { url: octoAlter.avatar_url } : undefined,
        proxy: proxies,
        groupsIDs: [],
        alterIDs: [],
        metadata: {
            importedFrom: 'octocon',
            importedAt: new Date(),
            octoconId: octoAlter.id
        }
    });
}

function createStateFromOctoconDiscord(octoAlter) {
    const proxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);

    return new State({
        name: {
            indexable: octoAlter.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `state${Date.now()}`
        },
        discord: {
            name: {
                display: octoAlter.name || 'Unknown'
            },
            description: octoAlter.description || undefined,
            color: octoAlter.color || undefined,
            image: {
                avatar: octoAlter.avatar_url ? { url: octoAlter.avatar_url } : undefined
            }
        },
        proxy: proxies,
        groupsIDs: [],
        alterIDs: [],
        metadata: {
            importedFrom: 'octocon',
            importedAt: new Date(),
            octoconId: octoAlter.id
        }
    });
}

function createGroupFromOctocon(tag) {
    return new Group({
        name: {
            indexable: tag.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
            display: tag.name || 'Unknown'
        },
        description: tag.description || undefined,
        color: tag.color || undefined,
        alterIDs: [],
        stateIDs: [],
        metadata: {
            importedFrom: 'octocon',
            importedAt: new Date(),
            octoconTagId: tag.id
        }
    });
}

// ============================================
// HELPER FUNCTIONS — UPDATE ENTITIES (Octocon)
// ============================================

async function updateAlterFromOctocon(alter, octoAlter, system, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        if (!alter.discord) alter.discord = {};
        if (!alter.discord.name) alter.discord.name = {};
        if (!alter.discord.image) alter.discord.image = {};

        if (octoAlter.name) alter.discord.name.display = octoAlter.name;
        if (octoAlter.description) alter.discord.description = octoAlter.description;
        if (octoAlter.color) alter.discord.color = octoAlter.color;
        if (octoAlter.avatar_url) alter.discord.image.avatar = { url: octoAlter.avatar_url };
    } else {
        if (octoAlter.name) alter.name.display = octoAlter.name;
        if (octoAlter.description) alter.description = octoAlter.description;
        if (octoAlter.pronouns) alter.pronouns = [octoAlter.pronouns];
        if (octoAlter.color) alter.color = octoAlter.color;
        if (octoAlter.avatar_url) alter.avatar = { url: octoAlter.avatar_url };
    }

    // Proxies always go to main proxy field
    const newProxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);
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
    alter.metadata.octoconId = octoAlter.id;
}

async function updateStateFromOctocon(state, octoAlter, system, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        if (!state.discord) state.discord = {};
        if (!state.discord.name) state.discord.name = {};
        if (!state.discord.image) state.discord.image = {};

        if (octoAlter.name) state.discord.name.display = octoAlter.name;
        if (octoAlter.description) state.discord.description = octoAlter.description;
        if (octoAlter.color) state.discord.color = octoAlter.color;
        if (octoAlter.avatar_url) state.discord.image.avatar = { url: octoAlter.avatar_url };
    } else {
        if (octoAlter.name) state.name.display = octoAlter.name;
        if (octoAlter.description) state.description = octoAlter.description;
        if (octoAlter.pronouns) state.pronouns = [octoAlter.pronouns];
        if (octoAlter.color) state.color = octoAlter.color;
        if (octoAlter.avatar_url) state.avatar = { url: octoAlter.avatar_url };
    }

    const newProxies = (octoAlter.discord_proxies || []).filter(p => p && p.length > 0);
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
    state.metadata.octoconId = octoAlter.id;
}

function updateGroupFromOctocon(group, tag) {
    if (tag.name) group.name.display = tag.name;
    if (tag.description) group.description = tag.description;
    if (tag.color) group.color = tag.color;

    group.metadata = group.metadata || {};
    group.metadata.octoconTagId = tag.id;
}

// ============================================
// FETCH OCTOCON ALTERS (for interactive states prompt)
// ============================================

async function fetchOctoconAlters(systemId) {
    const altersResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/alters`);
    if (!altersResponse.ok) {
        if (altersResponse.status === 404) throw new Error('System not found. Check your Octocon system ID.');
        throw new Error(`Octocon API error: ${altersResponse.status}`);
    }
    return await altersResponse.json();
}

// ============================================
// PREVIEW FUNCTIONS (fetch without writing)
// ============================================

async function previewOctoconData(system, data) {
    const members = [];
    for (const octoAlter of (data.alters || [])) {
        const existingAlter = await findExistingAlterOctocon(system, octoAlter);
        const existingState = await findExistingStateOctocon(system, octoAlter);
        const existing = existingAlter || existingState;

        members.push({
            sourceId: octoAlter.id,
            name: octoAlter.name,
            avatar: octoAlter.avatar_url || null,
            description: octoAlter.description || null,
            pronouns: octoAlter.pronouns || null,
            color: octoAlter.color || null,
            proxy: (octoAlter.discord_proxies || []).filter(p => p && p.length > 0),
            action: existing ? 'update' : 'new',
            existingId: existing?._id?.toString() || null,
            visibility: octoAlter.visible === false ? 'private' : 'public',
        });
    }

    const groups = [];
    for (const tag of (data.tags || [])) {
        const existingGroup = await findExistingGroupOctocon(system, tag);
        groups.push({
            sourceId: tag.id,
            name: tag.name,
            description: tag.description || null,
            color: tag.color || null,
            memberSourceIds: tag.alters || [],
            action: existingGroup ? 'update' : 'new',
            existingId: existingGroup?._id?.toString() || null,
            visibility: tag.visible === false ? 'private' : 'public',
        });
    }

    return { members, groups };
}

async function previewOctoconAPI(system, systemId) {
    const systemResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}`);
    if (!systemResponse.ok) throw new Error(`Octocon API error: ${systemResponse.status}`);
    const systemData = await systemResponse.json();

    const altersResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/alters`);
    if (!altersResponse.ok) throw new Error(`Octocon API error (alters): ${altersResponse.status}`);
    const altersData = await altersResponse.json();

    let tagsData = [];
    try {
        const tagsResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/tags`);
        if (tagsResponse.ok) tagsData = await tagsResponse.json();
    } catch {}

    const preview = await previewOctoconData(system, {
        user: systemData, alters: altersData, tags: tagsData
    });

    return {
        ...preview,
        systemInfo: {
            name: systemData.username || null,
            avatar: systemData.avatar_url || null,
            description: systemData.description || null,
        }
    };
}

async function previewOctoconFile(system, fileData) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;
    if (!data.user || !data.alters) throw new Error('Not an Octocon export file.');

    const preview = await previewOctoconData(system, data);

    return {
        ...preview,
        systemInfo: {
            name: data.user?.username || null,
            avatar: data.user?.avatar_url || null,
            description: data.user?.description || null,
        }
    };
}

module.exports = {
    parseOctoconId,
    importOctoconAPI,
    importOctoconFile,
    processOctoconData,
    importOctoconFronts,
    findExistingAlterOctocon,
    findExistingStateOctocon,
    findExistingGroupOctocon,
    createAlterFromOctocon,
    createAlterFromOctoconDiscord,
    createStateFromOctocon,
    createStateFromOctoconDiscord,
    createGroupFromOctocon,
    updateAlterFromOctocon,
    updateStateFromOctocon,
    updateGroupFromOctocon,
    fetchOctoconAlters,
    previewOctoconData,
    previewOctoconAPI,
    previewOctoconFile,
};
