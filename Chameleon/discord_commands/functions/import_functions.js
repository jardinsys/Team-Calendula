// Shared import functions for prefix commands and API routes
// Extracted from prefix/import.js — no Discord UI code, returns plain result objects

const mongoose = require('mongoose');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');
const utils = require('./bot_utils');

const PK_API_BASE = 'https://api.pluralkit.me/v2';
const SP_API_BASE = 'https://api.apparyllis.com/v1';

const TARGET_APP = 'app';
const TARGET_DISCORD = 'discord';
const IMPORT_COLOR = '#007bd8';

// ============================================
// URL PARSING (Phase 4)
// ============================================

function parsePluralKitUrl(input) {
    if (!input) return null;

    // URL format: pluralkit.me/systems/abc12 or pluralkit.me/systems/abc12-xyz
    const urlMatch = input.match(/pluralkit\.me\/systems\/([a-zA-Z0-9-]+)/i);
    if (urlMatch) return urlMatch[1].replace('-', '');

    // Short ID: 5-6 alphanumeric chars
    if (/^[a-zA-Z0-9]{5,6}$/.test(input)) return input;

    // UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input))
        return input;

    return null;
}

// ============================================
// PRE-IMPORT BACKUP (Phase 5)
// ============================================

async function createBackup(system, source) {
    const backup = {
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        source,
        memberCount: system.alters?.IDs?.length || 0,
        groupCount: system.groups?.IDs?.length || 0,
        snapshot: {
            alters: await Alter.find({ _id: { $in: system.alters?.IDs || [] } }).lean(),
            states: await State.find({ _id: { $in: system.states?.IDs || [] } }).lean(),
            groups: await Group.find({ _id: { $in: system.groups?.IDs || [] } }).lean()
        }
    };

    if (!system.metadata) system.metadata = {};
    if (!system.metadata.importBackups) system.metadata.importBackups = [];
    system.metadata.importBackups.push(backup);

    // Clean expired backups
    system.metadata.importBackups = system.metadata.importBackups.filter(
        b => b.expiresAt > new Date()
    );

    // Keep only last 3 non-expired backups
    if (system.metadata.importBackups.length > 3) {
        system.metadata.importBackups = system.metadata.importBackups.slice(-3);
    }

    await system.save();
    return backup;
}

// ============================================
// PLURALKIT API IMPORT (Phase 1 — pkapi.js)
// ============================================

async function importPluralKitAPI(system, user, token, options) {
    const PKAPI = require('pkapi.js').default;
    const api = new PKAPI({ token, user_agent: 'Systemiser Discord Bot (import)' });

    // Fetch system info
    const pkSystem = await api.getSystem({ token });

    // Fetch members (returns Map, convert to Array)
    const pkMembers = Array.from((await api.getMembers({ token })).values());

    // Fetch groups if not disabled (returns Map, convert to Array)
    let pkGroups = [];
    if (!options.noGroups) {
        pkGroups = Array.from((await api.getGroups({ token })).values());
    }

    // Fetch switches if not disabled
    let pkSwitches = [];
    if (!options.noSwitches) {
        const result = await api.getSwitches({ token, raw: false });
        pkSwitches = result?.switches ? Array.from(result.switches.values()) : [];
    }

    const result = await processPluralKitData(system, user, {
        system: pkSystem,
        members: pkMembers,
        groups: pkGroups,
        switches: pkSwitches
    }, options);

    return result;
}

// ============================================
// PLURALKIT FILE IMPORT
// ============================================

async function importPluralKitFile(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    // Validate PluralKit format
    if (!data.members && !data.name)
        throw new Error('This doesn\'t look like a PluralKit export file.');

    const result = await processPluralKitData(system, user, {
        system: data,
        members: data.members || [],
        groups: data.groups || [],
        switches: data.switches || []
    }, options);

    return result;
}

// ============================================
// PROCESS PLURALKIT DATA
// ============================================

async function processPluralKitData(system, user, data, options) {
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

    // Map PK member IDs to Systemiser alter/state IDs
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
                system.discord.image.avatar = { url: data.system.avatar_url };
            } else {
                system.avatar = { url: data.system.avatar_url };
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

        // Import PK system pronouns → user pronouns (prompt user before calling this)
        if (data.system.pronouns && options.applyPronouns && user) {
            user.pronouns = [data.system.pronouns];
            await user.save();
            result.pronounsApplied = true;
        }

        result.systemUpdated = true;
    }

    // Initialize arrays if needed
    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.states) system.states = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // Import members as alters OR states
    for (const pkMember of data.members) {
        try {
            // Check if this member should be imported as a state
            const memberNameLower = pkMember.name.toLowerCase();
            const displayNameLower = (pkMember.display_name || '').toLowerCase();
            const shouldBeState = options.stateNames?.some(sn =>
                sn === memberNameLower || sn === displayNameLower
            );

            if (shouldBeState) {
                // Import as STATE
                let existingState = await findExistingState(system, pkMember);

                if (existingState && options.skipExisting) {
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingState && !options.replace) {
                    updateStateFromPK(existingState, pkMember, options.target);
                    await existingState.save();
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.statesUpdated++;
                } else if (existingState && options.target === TARGET_DISCORD) {
                    updateStateFromPK(existingState, pkMember, options.target);
                    await existingState.save();
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.statesUpdated++;
                } else {
                    const newState = options.target === TARGET_DISCORD
                        ? createStateFromPKDiscord(pkMember)
                        : createStateFromPK(pkMember);
                    await newState.save();

                    if (!system.states.IDs.includes(newState._id)) {
                        system.states.IDs.push(newState._id);
                    }

                    memberIdMap.set(pkMember.id, { id: newState._id, type: 'state' });
                    result.statesImported++;
                }
            } else {
                // Import as ALTER (default)
                let existingAlter = await findExistingAlter(system, pkMember);

                if (existingAlter && options.skipExisting) {
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingAlter && !options.replace) {
                    updateAlterFromPK(existingAlter, pkMember, options.target);
                    await existingAlter.save();
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersUpdated++;
                } else if (existingAlter && options.target === TARGET_DISCORD) {
                    updateAlterFromPK(existingAlter, pkMember, options.target);
                    await existingAlter.save();
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersUpdated++;
                } else {
                    const newAlter = options.target === TARGET_DISCORD
                        ? createAlterFromPKDiscord(pkMember)
                        : createAlterFromPK(pkMember);
                    await newAlter.save();

                    if (!system.alters.IDs.includes(newAlter._id)) {
                        system.alters.IDs.push(newAlter._id);
                    }

                    memberIdMap.set(pkMember.id, { id: newAlter._id, type: 'alter' });
                    result.membersImported++;
                }
            }
        } catch (err) {
            result.errors.push(`Member "${pkMember.name}": ${err.message}`);
        }
    }

    // Import groups
    if (!options.noGroups && data.groups) {
        for (const pkGroup of data.groups) {
            try {
                let existingGroup = await findExistingGroup(system, pkGroup);

                if (existingGroup && options.skipExisting) {
                    result.groupsUpdated++;
                    continue;
                }

                if (existingGroup && !options.replace) {
                    updateGroupFromPK(existingGroup, pkGroup, memberIdMap);
                    await existingGroup.save();
                    result.groupsUpdated++;
                } else {
                    const newGroup = createGroupFromPK(pkGroup, memberIdMap);
                    await newGroup.save();

                    if (!system.groups.IDs.includes(newGroup._id))
                        system.groups.IDs.push(newGroup._id);

                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Group "${pkGroup.name}": ${err.message}`);
            }
        }
    }

    // Import switches as proper Shift documents (Phase 3)
    if (!options.noSwitches && data.switches && data.switches.length > 0) {
        const importedShifts = await importSwitches(system, data.switches, memberIdMap, options);
        result.switchesImported = importedShifts;
    }

    await system.save();

    return result;
}

// ============================================
// TUPPERBOX FILE IMPORT
// ============================================

async function importTupperboxFile(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    if (!data.tuppers)
        throw new Error('This doesn\'t look like a Tupperbox export file.');

    const result = await processTupperboxData(system, data, options);
    return result;
}

async function processTupperboxData(system, data, options) {
    const result = {
        systemUpdated: false,
        membersImported: 0,
        membersUpdated: 0,
        membersSkipped: 0,
        groupsImported: 0,
        groupsUpdated: 0,
        switchesImported: 0,
        errors: []
    };

    const groupIdMap = new Map();

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // Import groups first (if present)
    if (!options.noGroups && data.groups) {
        for (const tbGroup of data.groups) {
            try {
                let existingGroup = await Group.findOne({
                    _id: { $in: system.groups.IDs || [] },
                    'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tbGroup.name)}$`, 'i') }
                });

                if (existingGroup && options.skipExisting) {
                    groupIdMap.set(tbGroup.id, existingGroup._id);
                    continue;
                }

                if (existingGroup && !options.replace) {
                    if (tbGroup.tag) existingGroup.signoff = tbGroup.tag;
                    await existingGroup.save();
                    groupIdMap.set(tbGroup.id, existingGroup._id);
                    result.groupsUpdated++;
                } else {
                    const newGroup = new Group({
                        name: {
                            indexable: tbGroup.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
                            display: tbGroup.name
                        },
                        signoff: tbGroup.tag || undefined,
                        memberIDs: [],
                        metadata: {
                            importedFrom: 'tupperbox',
                            importedAt: new Date()
                        }
                    });
                    await newGroup.save();

                    if (!system.groups.IDs.includes(newGroup._id)) {
                        system.groups.IDs.push(newGroup._id);
                    }

                    groupIdMap.set(tbGroup.id, newGroup._id);
                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Group "${tbGroup.name}": ${err.message}`);
            }
        }
    }

    // Import tuppers as alters
    for (const tupper of data.tuppers) {
        try {
            let existingAlter = await Alter.findOne({
                _id: { $in: system.alters.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(tupper.name)}$`, 'i') }
            });

            if (existingAlter && options.skipExisting) {
                result.membersSkipped++;
                continue;
            }

            const proxy = convertTBBracketsToProxy(tupper.brackets);

            if (existingAlter && !options.replace) {
                if (tupper.avatar_url) existingAlter.avatar = { url: tupper.avatar_url };
                if (tupper.nick) existingAlter.name.display = tupper.nick;
                if (tupper.description) existingAlter.description = tupper.description;
                if (proxy && !existingAlter.proxy?.includes(proxy)) {
                    existingAlter.proxy = existingAlter.proxy || [];
                    existingAlter.proxy.push(proxy);
                }
                if (tupper.tag) existingAlter.signoff = tupper.tag;

                await existingAlter.save();

                if (tupper.group_id && groupIdMap.has(tupper.group_id)) {
                    await addAlterToGroup(existingAlter._id, groupIdMap.get(tupper.group_id));
                }

                result.membersUpdated++;
            } else {
                const newAlter = new Alter({
                    name: {
                        indexable: tupper.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`,
                        display: tupper.nick || tupper.name
                    },
                    avatar: tupper.avatar_url ? { url: tupper.avatar_url } : undefined,
                    description: tupper.description || undefined,
                    proxy: proxy ? [proxy] : [],
                    signoff: tupper.tag || undefined,
                    groupsIDs: [],
                    metadata: {
                        importedFrom: 'tupperbox',
                        importedAt: new Date()
                    }
                });
                await newAlter.save();

                if (!system.alters.IDs.includes(newAlter._id)) {
                    system.alters.IDs.push(newAlter._id);
                }

                if (tupper.group_id && groupIdMap.has(tupper.group_id)) {
                    await addAlterToGroup(newAlter._id, groupIdMap.get(tupper.group_id));
                    newAlter.groupsIDs.push(groupIdMap.get(tupper.group_id));
                    await newAlter.save();
                }

                result.membersImported++;
            }
        } catch (err) {
            result.errors.push(`Tupper "${tupper.name}": ${err.message}`);
        }
    }

    await system.save();
    return result;
}

// ============================================
// SIMPLY PLURAL API IMPORT
// ============================================

async function importSimplyPluralAPI(system, user, token, options) {
    // Fetch members
    const membersResponse = await fetch(`${SP_API_BASE}/members`, {
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
        }
    });

    if (!membersResponse.ok) {
        if (membersResponse.status === 401 || membersResponse.status === 403)
            throw new Error('Invalid or expired token. Create a new one in Simply Plural settings.');
        throw new Error(`Simply Plural API error: ${membersResponse.status}`);
    }

    const spMembers = await membersResponse.json();

    // Fetch groups
    let spGroups = {};
    if (!options.noGroups) {
        const groupsResponse = await fetch(`${SP_API_BASE}/groups`, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (groupsResponse.ok)
            spGroups = await groupsResponse.json();
    }

    const result = await processSimplyPluralData(system, {
        members: spMembers,
        groups: spGroups
    }, options);

    return result;
}

async function processSimplyPluralData(system, data, options) {
    const result = {
        systemUpdated: false,
        membersImported: 0,
        membersUpdated: 0,
        membersSkipped: 0,
        groupsImported: 0,
        groupsUpdated: 0,
        switchesImported: 0,
        errors: []
    };

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // SP returns members as object with IDs as keys
    const members = Object.values(data.members);

    for (const spMember of members) {
        try {
            if (spMember.archived) continue;

            let existingAlter = await Alter.findOne({
                _id: { $in: system.alters.IDs || [] },
                'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spMember.name)}$`, 'i') }
            });

            if (existingAlter && options.skipExisting) {
                result.membersSkipped++;
                continue;
            }

            if (existingAlter && !options.replace) {
                if (spMember.avatarUrl) existingAlter.avatar = { url: spMember.avatarUrl };
                if (spMember.desc) existingAlter.description = spMember.desc;
                if (spMember.pronouns) existingAlter.pronouns = [spMember.pronouns];
                if (spMember.color) existingAlter.color = spMember.color;
                if (spMember.pkId) {
                    existingAlter.metadata = existingAlter.metadata || {};
                    existingAlter.metadata.pluralKitId = spMember.pkId;
                }

                await existingAlter.save();
                result.membersUpdated++;
            } else {
                const newAlter = new Alter({
                    name: {
                        indexable: spMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`,
                        display: spMember.name
                    },
                    avatar: spMember.avatarUrl ? { url: spMember.avatarUrl } : undefined,
                    description: spMember.desc || undefined,
                    pronouns: spMember.pronouns ? [spMember.pronouns] : [],
                    color: spMember.color || undefined,
                    proxy: [],
                    groupsIDs: [],
                    metadata: {
                        importedFrom: 'simplyplural',
                        importedAt: new Date(),
                        simplyPluralId: spMember.uid,
                        pluralKitId: spMember.pkId || undefined
                    }
                });
                await newAlter.save();

                if (!system.alters.IDs.includes(newAlter._id))
                    system.alters.IDs.push(newAlter._id);

                result.membersImported++;
            }
        } catch (err) {
            result.errors.push(`Member "${spMember.name}": ${err.message}`);
        }
    }

    // Import groups
    if (!options.noGroups && data.groups) {
        const groups = Object.values(data.groups);

        for (const spGroup of groups) {
            try {
                let existingGroup = await Group.findOne({
                    _id: { $in: system.groups.IDs || [] },
                    'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spGroup.name)}$`, 'i') }
                });

                if (existingGroup && options.skipExisting) continue;

                if (existingGroup && !options.replace) {
                    if (spGroup.desc) existingGroup.description = spGroup.desc;
                    if (spGroup.color) existingGroup.color = spGroup.color;
                    await existingGroup.save();
                    result.groupsUpdated++;
                } else {
                    const newGroup = new Group({
                        name: {
                            indexable: spGroup.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
                            display: spGroup.name
                        },
                        description: spGroup.desc || undefined,
                        color: spGroup.color || undefined,
                        memberIDs: [],
                        metadata: {
                            importedFrom: 'simplyplural',
                            importedAt: new Date()
                        }
                    });
                    await newGroup.save();

                    if (!system.groups.IDs.includes(newGroup._id)) system.groups.IDs.push(newGroup._id);

                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Group "${spGroup.name}": ${err.message}`);
            }
        }
    }

    await system.save();
    return result;
}

// ============================================
// AUTO-DETECT FORMAT
// ============================================

async function importAutoDetect(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    // Detect format
    if (data.tuppers) {
        return await processTupperboxData(system, data, options);
    } else if (data.members || data.id) {
        return await processPluralKitData(system, user, {
            system: data,
            members: data.members || [],
            groups: data.groups || [],
            switches: data.switches || []
        }, options);
    } else {
        throw new Error('Could not detect file format. Please specify the source (pluralkit, tupperbox, simplyplural).');
    }
}

// ============================================
// SWITCH IMPORT (Phase 3)
// ============================================

async function importSwitches(system, pkSwitches, memberIdMap, options) {
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
            const alter = await Alter.findById(memberId);
            const state = alter ? null : await State.findById(memberId);
            members.push({
                s_type: alter ? 'alter' : 'state',
                ID: memberId,
                type_name: (alter || state)?.name?.display || 'Unknown'
            });
        }

        const shift = new Shift({
            s_type: 'alter',
            ID: system._id,
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
        });

        await shift.save();
        targetLayer.shifts.push(shift._id);
        imported++;
    }

    await system.save();
    return imported;
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
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid
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
                banner: pkMember.banner ? { url: pkMember.banner } : undefined
            }
        },
        proxy: proxies,
        groupsIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid
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
        proxy: proxies,
        groupsIDs: [],
        alterIDs: [],
        metadata: {
            addedAt: pkMember.created ? new Date(pkMember.created) : new Date(),
            importedFrom: 'pluralkit',
            importedAt: new Date(),
            pluralKitId: pkMember.id,
            pluralKitUuid: pkMember.uuid
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
                banner: pkMember.banner ? { url: pkMember.banner } : undefined
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
            pluralKitUuid: pkMember.uuid
        }
    });
}

function createGroupFromPK(pkGroup, memberIdMap) {
    const alterIDs = [];
    const stateIDs = [];

    for (const m of (pkGroup.members || [])) {
        const mapped = memberIdMap.get(typeof m === 'string' ? m : m.id);
        if (mapped) {
            if (mapped.type === 'state') {
                stateIDs.push(mapped.id);
            } else {
                alterIDs.push(mapped.id);
            }
        }
    }

    return new Group({
        name: {
            indexable: pkGroup.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
            display: pkGroup.display_name || pkGroup.name
        },
        description: pkGroup.description || undefined,
        color: pkGroup.color ? `#${pkGroup.color}` : undefined,
        avatar: pkGroup.icon ? { url: pkGroup.icon } : undefined,
        memberIDs: alterIDs,
        stateIDs: stateIDs,
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

function updateAlterFromPK(alter, pkMember, targetMode = TARGET_APP) {
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
    }

    // Proxy tags always go to main proxy field
    const newProxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    for (const proxy of newProxies) {
        if (!alter.proxy?.includes(proxy)) {
            alter.proxy = alter.proxy || [];
            alter.proxy.push(proxy);
        }
    }

    alter.metadata = alter.metadata || {};
    alter.metadata.pluralKitId = pkMember.id;
    alter.metadata.pluralKitUuid = pkMember.uuid;
}

function updateStateFromPK(state, pkMember, targetMode = TARGET_APP) {
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
    }

    const newProxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    for (const proxy of newProxies) {
        if (!state.proxy?.includes(proxy)) {
            state.proxy = state.proxy || [];
            state.proxy.push(proxy);
        }
    }

    state.metadata = state.metadata || {};
    state.metadata.pluralKitId = pkMember.id;
    state.metadata.pluralKitUuid = pkMember.uuid;
}

function updateGroupFromPK(group, pkGroup, memberIdMap) {
    if (pkGroup.display_name) group.name.display = pkGroup.display_name;
    if (pkGroup.description) group.description = pkGroup.description;
    if (pkGroup.color) group.color = `#${pkGroup.color}`;
    if (pkGroup.icon) group.avatar = { url: pkGroup.icon };

    for (const m of (pkGroup.members || [])) {
        const mapped = memberIdMap.get(typeof m === 'string' ? m : m.id);
        if (mapped) {
            if (mapped.type === 'state') {
                if (!group.stateIDs) group.stateIDs = [];
                if (!group.stateIDs.includes(mapped.id)) {
                    group.stateIDs.push(mapped.id);
                }
            } else {
                if (!group.memberIDs) group.memberIDs = [];
                if (!group.memberIDs.includes(mapped.id)) {
                    group.memberIDs.push(mapped.id);
                }
            }
        }
    }

    group.metadata = group.metadata || {};
    group.metadata.pluralKitId = pkGroup.id;
    group.metadata.pluralKitUuid = pkGroup.uuid;
}

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

async function addAlterToGroup(alterId, groupId) {
    const group = await Group.findById(groupId);
    if (group && !group.memberIDs?.includes(alterId)) {
        group.memberIDs = group.memberIDs || [];
        group.memberIDs.push(alterId);
        await group.save();
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Constants
    PK_API_BASE,
    SP_API_BASE,
    TARGET_APP,
    TARGET_DISCORD,
    IMPORT_COLOR,

    // URL parsing
    parsePluralKitUrl,

    // Backup
    createBackup,

    // Main import entry points
    importPluralKitAPI,
    importPluralKitFile,
    importTupperboxFile,
    importSimplyPluralAPI,
    importAutoDetect,

    // Core data processors
    processPluralKitData,
    processTupperboxData,
    processSimplyPluralData,

    // Entity helpers
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

    // Switch import
    importSwitches,

    // Misc helpers
    convertTBBracketsToProxy,
    addAlterToGroup,
};
