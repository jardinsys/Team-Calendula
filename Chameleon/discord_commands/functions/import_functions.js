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
const OCTOCON_API_BASE = 'https://octocon.app';

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
// OCTOCON API IMPORT
// ============================================

async function importOctoconAPI(system, user, systemId, options) {
    // Fetch system info
    const systemResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}`);
    if (!systemResponse.ok) {
        if (systemResponse.status === 404) throw new Error('System not found. Check your Octocon system ID (7 characters, e.g. `abcdefg`).');
        throw new Error(`Octocon API error: ${systemResponse.status}`);
    }
    const systemData = await systemResponse.json();

    // Fetch alters
    const altersResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/alters`);
    if (!altersResponse.ok) throw new Error(`Octocon API error (alters): ${altersResponse.status}`);
    const altersData = await altersResponse.json();

    // Fetch tags (groups equivalent)
    let tagsData = [];
    if (!options.noGroups) {
        const tagsResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/tags`);
        if (tagsResponse.ok) tagsData = await tagsResponse.json();
    }

    // Fetch front entries
    let frontData = [];
    if (!options.noSwitches) {
        const frontResponse = await fetch(`${OCTOCON_API_BASE}/api/systems/${systemId}/fronting`);
        if (frontResponse.ok) frontData = await frontResponse.json();
    }

    const result = await processOctoconData(system, user, {
        user: systemData,
        alters: altersData,
        tags: tagsData,
        fronts: frontData
    }, options);

    return result;
}

// ============================================
// OCTOCON FILE IMPORT
// ============================================

async function importOctoconFile(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    if (!data.user || !data.alters)
        throw new Error('This doesn\'t look like an Octocon export file.');

    const result = await processOctoconData(system, user, data, options);
    return result;
}

// ============================================
// PROCESS OCTOCON DATA
// ============================================

async function processOctoconData(system, user, data, options) {
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

    // Map Octocon alter IDs to Systemiser alter/state IDs
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
                system.discord.image.avatar = { url: data.user.avatar_url };
            } else {
                system.avatar = { url: data.user.avatar_url };
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

        result.systemUpdated = true;
    }

    // Initialize arrays if needed
    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.states) system.states = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // Import alters
    for (const octoAlter of (data.alters || [])) {
        try {
            const alterNameLower = octoAlter.name?.toLowerCase();
            const shouldBeState = options.stateNames?.some(sn => sn === alterNameLower);

            if (shouldBeState) {
                // Import as STATE
                let existingState = await findExistingStateOctocon(system, octoAlter);

                if (existingState && options.skipExisting) {
                    alterIdMap.set(octoAlter.id, { id: existingState._id, type: 'state' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingState && !options.replace) {
                    updateStateFromOctocon(existingState, octoAlter, options.target);
                    await existingState.save();
                    alterIdMap.set(octoAlter.id, { id: existingState._id, type: 'state' });
                    result.statesUpdated++;
                } else {
                    const newState = options.target === TARGET_DISCORD
                        ? createStateFromOctoconDiscord(octoAlter)
                        : createStateFromOctocon(octoAlter);
                    await newState.save();

                    if (!system.states.IDs.includes(newState._id)) {
                        system.states.IDs.push(newState._id);
                    }

                    alterIdMap.set(octoAlter.id, { id: newState._id, type: 'state' });
                    result.statesImported++;
                }
            } else {
                // Import as ALTER (default)
                let existingAlter = await findExistingAlterOctocon(system, octoAlter);

                if (existingAlter && options.skipExisting) {
                    alterIdMap.set(octoAlter.id, { id: existingAlter._id, type: 'alter' });
                    result.membersSkipped++;
                    continue;
                }

                if (existingAlter && !options.replace) {
                    updateAlterFromOctocon(existingAlter, octoAlter, options.target);
                    await existingAlter.save();
                    alterIdMap.set(octoAlter.id, { id: existingAlter._id, type: 'alter' });
                    result.membersUpdated++;
                } else {
                    const newAlter = options.target === TARGET_DISCORD
                        ? createAlterFromOctoconDiscord(octoAlter)
                        : createAlterFromOctocon(octoAlter);
                    await newAlter.save();

                    if (!system.alters.IDs.includes(newAlter._id)) {
                        system.alters.IDs.push(newAlter._id);
                    }

                    alterIdMap.set(octoAlter.id, { id: newAlter._id, type: 'alter' });
                    result.membersImported++;
                }
            }
        } catch (err) {
            result.errors.push(`Alter "${octoAlter.name}": ${err.message}`);
        }
    }

    // Import tags as groups
    if (!options.noGroups && data.tags) {
        for (const tag of data.tags) {
            try {
                let existingGroup = await findExistingGroupOctocon(system, tag);

                if (existingGroup && options.skipExisting) {
                    result.groupsUpdated++;
                    continue;
                }

                if (existingGroup && !options.replace) {
                    updateGroupFromOctocon(existingGroup, tag, alterIdMap);
                    await existingGroup.save();
                    result.groupsUpdated++;
                } else {
                    const newGroup = createGroupFromOctocon(tag, alterIdMap);
                    await newGroup.save();

                    if (!system.groups.IDs.includes(newGroup._id))
                        system.groups.IDs.push(newGroup._id);

                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Tag "${tag.name}": ${err.message}`);
            }
        }
    }

    // Import front entries as switches
    if (!options.noSwitches && data.fronts && data.fronts.length > 0) {
        const importedShifts = await importOctoconFronts(system, data.fronts, alterIdMap, options);
        result.switchesImported = importedShifts;
    }

    await system.save();
    return result;
}

// ============================================
// OCTOCON FRONT IMPORT
// ============================================

async function importOctoconFronts(system, fronts, alterIdMap, options) {
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

        const shift = new Shift({
            s_type: 'alter',
            ID: system._id,
            type_name: system.name?.display || 'System',
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

function createGroupFromOctocon(tag, alterIdMap) {
    const alterIDs = [];

    for (const alterId of (tag.alters || [])) {
        const mapped = alterIdMap.get(alterId);
        if (mapped && mapped.type === 'alter') {
            alterIDs.push(mapped.id);
        }
    }

    return new Group({
        name: {
            indexable: tag.name?.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `group${Date.now()}`,
            display: tag.name || 'Unknown'
        },
        description: tag.description || undefined,
        color: tag.color || undefined,
        memberIDs: alterIDs,
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

function updateAlterFromOctocon(alter, octoAlter, targetMode = TARGET_APP) {
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
            alter.proxy = alter.proxy || [];
            alter.proxy.push(proxy);
        }
    }

    alter.metadata = alter.metadata || {};
    alter.metadata.octoconId = octoAlter.id;
}

function updateStateFromOctocon(state, octoAlter, targetMode = TARGET_APP) {
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
            state.proxy = state.proxy || [];
            state.proxy.push(proxy);
        }
    }

    state.metadata = state.metadata || {};
    state.metadata.octoconId = octoAlter.id;
}

function updateGroupFromOctocon(group, tag, alterIdMap) {
    if (tag.name) group.name.display = tag.name;
    if (tag.description) group.description = tag.description;
    if (tag.color) group.color = tag.color;

    for (const alterId of (tag.alters || [])) {
        const mapped = alterIdMap.get(alterId);
        if (mapped && mapped.type === 'alter') {
            if (!group.memberIDs) group.memberIDs = [];
            if (!group.memberIDs.includes(mapped.id)) {
                group.memberIDs.push(mapped.id);
            }
        }
    }

    group.metadata = group.metadata || {};
    group.metadata.octoconTagId = tag.id;
}

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
// AUTO-DETECT FORMAT
// ============================================

async function importAutoDetect(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    // Detect format
    if (data.tuppers) {
        return await processTupperboxData(system, data, options);
    } else if (data.user && data.alters && data.tags) {
        // Octocon format: user + alters + tags (tags distinguishes from PK which has members)
        return await processOctoconData(system, user, data, options);
    } else if (data.members || data.id) {
        return await processPluralKitData(system, user, {
            system: data,
            members: data.members || [],
            groups: data.groups || [],
            switches: data.switches || []
        }, options);
    } else {
        throw new Error('Could not detect file format. Please specify the source (pluralkit, tupperbox, simplyplural, octocon).');
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
    OCTOCON_API_BASE,
    TARGET_APP,
    TARGET_DISCORD,
    IMPORT_COLOR,

    // URL parsing
    parsePluralKitUrl,
    parseOctoconId,

    // Backup
    createBackup,

    // Main import entry points
    importPluralKitAPI,
    importPluralKitFile,
    importTupperboxFile,
    importSimplyPluralAPI,
    importOctoconAPI,
    importOctoconFile,
    importAutoDetect,

    // Core data processors
    processPluralKitData,
    processTupperboxData,
    processSimplyPluralData,
    processOctoconData,

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

    // Octocon entity helpers
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

    // Switch import
    importSwitches,
    importOctoconFronts,

    // Misc helpers
    convertTBBracketsToProxy,
    addAlterToGroup,
};
