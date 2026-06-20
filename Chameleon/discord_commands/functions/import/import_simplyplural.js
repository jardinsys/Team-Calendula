// Simply Plural import functions
// Extracted from import_functions.js — all Simply Plural-specific logic

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../bot_utils');
const { syncEntityImages, isMemberSelected } = require('./helpers');
const { TARGET_APP, TARGET_DISCORD, SP_API_BASE } = require('./constants');

// ============================================
// SIMPLY PLURAL API IMPORT
// ============================================

async function importSimplyPluralAPI(system, user, token, options, onProgress) {
    const emit = onProgress || (() => {});

    emit({ phase: 'fetching', message: 'Connecting to Simply Plural API...' });

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
    const memberCount = Object.values(spMembers).length;

    emit({ phase: 'fetching', message: `Found ${memberCount} member${memberCount !== 1 ? 's' : ''}. Fetching groups...` });

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

    const groupCount = Object.values(spGroups).length;
    emit({ phase: 'fetching', message: `Found ${groupCount} group${groupCount !== 1 ? 's' : ''}. Starting import...` });

    const result = await processSimplyPluralData(system, {
        members: spMembers,
        groups: spGroups
    }, options, onProgress);

    return result;
}

// ============================================
// PROCESS SIMPLY PLURAL DATA
// ============================================

async function processSimplyPluralData(system, data, options, onProgress) {
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
        errors: []
    };

    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.states) system.states = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // GROUPS FIRST
    // Note: SP API does not provide member references in group objects,
    // so groupMembershipMap will be empty. Infrastructure is ready if SP adds this.
    const groupMembershipMap = new Map();

    if (!options.noGroups && data.groups) {
        const groups = Object.values(data.groups);
        let groupIdx = 0;
        for (const spGroup of groups) {
            groupIdx++;
            try {
                emit({ phase: 'groups', current: groupIdx, total: groups.length, entityName: spGroup.name, message: `Importing group ${groupIdx}/${groups.length}: ${spGroup.name}` });

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
                        alterIDs: [],
                        metadata: {
                            importedFrom: 'simplyplural',
                            importedAt: new Date()
                        }
                    });
                    await syncEntityImages(newGroup, spGroup, 'Group', system, options.target);
                    await utils.createAndLinkEntity(newGroup, system, 'group');
                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Group "${spGroup.name}": ${err.message}`);
            }
        }
    }

    // MEMBERS
    const members = Object.values(data.members);
    let memberIdx = 0;
    for (const spMember of members) {
        memberIdx++;
        try {
            if (spMember.archived) continue;

            emit({ phase: 'members', current: memberIdx, total: members.length, entityName: spMember.name, message: `Importing member ${memberIdx}/${members.length}: ${spMember.name}` });

            if (!isMemberSelected(spMember.uid, options)) continue;

            const memberNameLower = spMember.name?.toLowerCase();
            const shouldBeState = options.forceAsStates || options.stateNames?.some(sn => sn === memberNameLower);

            let entity = null;
            let entityType = shouldBeState ? 'state' : 'alter';

            if (shouldBeState) {
                let existingState = await State.findOne({
                    _id: { $in: system.states.IDs || [] },
                    'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(spMember.name)}$`, 'i') }
                });

                if (existingState && options.skipExisting) {
                    result.membersSkipped++;
                    continue;
                }

                if (existingState && !options.replace) {
                    if (spMember.avatarUrl) existingState.avatar = { url: spMember.avatarUrl };
                    if (spMember.desc) existingState.description = spMember.desc;
                    if (spMember.pronouns) existingState.pronouns = [spMember.pronouns];
                    if (spMember.color) existingState.color = spMember.color;
                                        await existingState.save();
                    entity = existingState;
                    result.statesUpdated++;
                } else {
                    const newState = new State({
                        name: {
                            indexable: spMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `state${Date.now()}`,
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
                    await syncEntityImages(newState, spMember, 'State', system, options.target);
                    await utils.createAndLinkEntity(newState, system, 'state');
                    entity = newState;
                    result.statesImported++;
                }
            } else {
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
                    entity = existingAlter;
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
                    await syncEntityImages(newAlter, spMember, 'Alter', system, options.target);
                    await utils.createAndLinkEntity(newAlter, system, 'alter');
                    entity = newAlter;
                    result.membersImported++;
                }
            }

            // Link to groups (currently empty for SP, ready for when API provides member refs)
            if (entity) {
                for (const [groupId, sourceMemberIds] of groupMembershipMap) {
                    if (sourceMemberIds.includes(spMember.uid)) {
                        await utils.linkEntityToGroup(entity._id, groupId, entityType);
                    }
                }
            }
        } catch (err) {
            result.errors.push(`Member "${spMember.name}": ${err.message}`);
        }
    }

    emit({ phase: 'saving', message: 'Saving system...' });
    await system.save();
    return result;
}

// ============================================
// FETCH SP MEMBERS (for interactive states prompt)
// ============================================

async function fetchSPMembers(token) {
    const membersResponse = await fetch(`${SP_API_BASE}/members`, {
        headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    });
    if (!membersResponse.ok) {
        if (membersResponse.status === 401 || membersResponse.status === 403)
            throw new Error('Invalid or expired token. Create a new one in Simply Plural settings.');
        throw new Error(`Simply Plural API error: ${membersResponse.status}`);
    }
    const data = await membersResponse.json();
    return Object.values(data).filter(m => !m.archived);
}

// ============================================
// PREVIEW FUNCTIONS (fetch without writing)
// ============================================

async function previewSimplyPluralData(system, data) {
    const members = [];
    const spMembers = Object.values(data.members || {});
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

        members.push({
            sourceId: spMember.uid,
            name: spMember.name,
            avatar: spMember.avatarUrl || null,
            description: spMember.desc || null,
            pronouns: spMember.pronouns || null,
            color: spMember.color || null,
            proxy: [],
            action: existing ? 'update' : 'new',
            existingId: existing?._id?.toString() || null,
            visibility: 'public',
        });
    }

    const groups = [];
    for (const spGroup of Object.values(data.groups || {})) {
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
            memberSourceIds: [],
            action: existingGroup ? 'update' : 'new',
            existingId: existingGroup?._id?.toString() || null,
            visibility: 'public',
        });
    }

    return { members, groups };
}

async function previewSimplyPluralAPI(system, token) {
    const membersResponse = await fetch(`${SP_API_BASE}/members`, {
        headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    });
    if (!membersResponse.ok) throw new Error(`SP API error: ${membersResponse.status}`);
    const spMembers = await membersResponse.json();

    let spGroups = {};
    try {
        const groupsResponse = await fetch(`${SP_API_BASE}/groups`, {
            headers: { 'Authorization': token, 'Content-Type': 'application/json' }
        });
        if (groupsResponse.ok) spGroups = await groupsResponse.json();
    } catch {}

    return await previewSimplyPluralData(system, { members: spMembers, groups: spGroups });
}

module.exports = {
    importSimplyPluralAPI,
    processSimplyPluralData,
    fetchSPMembers,
    previewSimplyPluralData,
    previewSimplyPluralAPI,
};
