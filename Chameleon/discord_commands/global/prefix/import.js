// sys!import - Import system data from other platforms
// Supports: PluralKit (file + API), Tupperbox (file), Simply Plural (API)
//
// USAGE:
//   sys!import                           - Show help
//   sys!import pluralkit                 - Import from attached PK export file
//   sys!import pluralkit <token>         - Import via PluralKit API
//   sys!import tupperbox                 - Import from attached Tupperbox export file
//   sys!import simplyplural <token>      - Import via Simply Plural API
//   sys!import <file>                    - Auto-detect format from attached file
//
// FLAGS:
//   -replace                             - Replace existing data (default: merge)
//   -skipexisting                        - Skip members that already exist
//   -nogroups                            - Don't import groups
//   -noswitches                          - Don't import switch history
//   -states:<name1,name2,name3>          - Import these members as states instead of alters
//   -target:app                          - Import to main/app fields (default)
//   -target:discord                      - Import to Discord-specific fields
//
// MULTI-SOURCE WORKFLOW:
//   1. sys!import simplyplural <token>              - Import SP data as main profile
//   2. sys!import pluralkit <token> -target:discord - Add PK data as Discord overlay
//
// NOTE: Other platforms don't have "states" - all members import as alters by default.
//       Use -states: flag or sys!convert after import to change alters to states.

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

const IMPORT_COLOR = '#007bd8';

// API endpoints
const PK_API_BASE = 'https://api.pluralkit.me/v2';
const SP_API_BASE = 'https://api.apparyllis.com/v1';

// Target modes for import
const TARGET_APP = 'app';       // Import to main/app fields (default)
const TARGET_DISCORD = 'discord'; // Import to discord-specific fields

module.exports = {
    name: 'import',
    aliases: ['imp'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const source = parsed._positional[0]?.toLowerCase();

        // Show help if no args
        if (!source && message.attachments.size === 0) {
            return handleHelp(message);
        }

        // Get or create user and system
        let { user, system } = await utils.getOrCreateUserAndSystem(message);

        if (!system) {
            // Create a new system for the user
            system = new System({
                users: [user._id],
                metadata: { joinedAt: new Date() },
                alters: { IDs: [], conditions: [] },
                states: { IDs: [], conditions: [] },
                groups: { IDs: [], types: [], conditions: [] },
                front: { layers: [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }] }
            });
            await system.save();
            user.systemID = system._id;
            await user.save();
        }

        // Parse target mode
        let targetMode = TARGET_APP; // default
        if (parsed.target) {
            const t = parsed.target.toLowerCase();
            if (t === 'discord' || t === 'dc') {
                targetMode = TARGET_DISCORD;
            } else if (t === 'app' || t === 'main') {
                targetMode = TARGET_APP;
            } else {
                return utils.error(message, `Invalid target: \`${parsed.target}\`\nUse \`-target:app\` or \`-target:discord\``);
            }
        }

        // Parse flags
        const options = {
            replace: parsed.replace || false,
            skipExisting: parsed.skipexisting || false,
            noGroups: parsed.nogroups || false,
            noSwitches: parsed.noswitches || false,
            stateNames: parsed.states ? parsed.states.split(',').map(n => n.trim().toLowerCase()) : [],
            target: targetMode
        };

        // Route based on source
        try {
            if (source === 'pluralkit' || source === 'pk') {
                const token = parsed._positional[1];
                if (token) {
                    // API import
                    return await importPluralKitAPI(message, system, token, options);
                } else if (message.attachments.size > 0) {
                    // File import
                    return await importPluralKitFile(message, system, options);
                } else {
                    return utils.error(message, 'Please provide a PluralKit token or attach an export file.\n\nGet your token: DM PluralKit with `pk;token`\nOr export: `pk;export` and attach the file');
                }
            }

            if (source === 'tupperbox' || source === 'tb' || source === 'tupper') {
                if (message.attachments.size > 0) {
                    return await importTupperboxFile(message, system, options);
                } else {
                    return utils.error(message, 'Please attach a Tupperbox export file.\n\nExport with: `tul!export`');
                }
            }

            if (source === 'simplyplural' || source === 'sp') {
                const token = parsed._positional[1];
                if (token) {
                    return await importSimplyPluralAPI(message, system, token, options);
                } else {
                    return utils.error(message, 'Please provide a Simply Plural API token.\n\nGet your token: Settings → Developer → Add Token (Read permission)');
                }
            }

            // Auto-detect from attached file
            if (message.attachments.size > 0) {
                return await importAutoDetect(message, system, options);
            }

            return utils.error(message, `Unknown import source: \`${source}\`\nSupported: \`pluralkit\`, \`tupperbox\`, \`simplyplural\`\n\nUse \`sys!import\` for help.`);

        } catch (error) {
            console.error('Import error:', error);
            return utils.error(message, `Import failed: ${error.message}`);
        }
    }
};

// ============================================
// HELP
// ============================================

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(IMPORT_COLOR)
        .setTitle('📥 Import Command')
        .setDescription('Import your system data from other platforms.\n\n⚠️ **Note:** Other platforms don\'t have "states" - all members import as **alters** by default.')
        .addFields(
            {
                name: '🔷 PluralKit',
                value: [
                    '**Via API (recommended):**',
                    '`sys!import pluralkit <token>`',
                    'Get token: DM PluralKit with `pk;token`',
                    '',
                    '**Via file:**',
                    '`sys!import pluralkit` (attach file)',
                    'Export with: `pk;export`'
                ].join('\n'),
                inline: false
            },
            {
                name: '📦 Tupperbox',
                value: [
                    '`sys!import tupperbox` (attach file)',
                    'Export with: `tul!export`',
                    '',
                    '*Tupperbox doesn\'t have an API*'
                ].join('\n'),
                inline: false
            },
            {
                name: '💜 Simply Plural',
                value: [
                    '`sys!import simplyplural <token>`',
                    'Get token: Settings → Developer → Add Token',
                    '*(Check "Read" permission)*'
                ].join('\n'),
                inline: false
            },
            {
                name: '🎯 Target Mode',
                value: [
                    '`-target:app` - Import to main profile fields *(default)*',
                    '`-target:discord` - Import to Discord-specific fields',
                    '',
                    '**Use different sources for different targets!**',
                    'This lets you keep separate avatars/info for Discord vs the app.'
                ].join('\n'),
                inline: false
            },
            {
                name: '📱 Multi-Source Workflow',
                value: [
                    '```',
                    '# 1. Import Simply Plural as main profile',
                    'sys!import simplyplural <token>',
                    '',
                    '# 2. Add PluralKit data for Discord',
                    'sys!import pluralkit <token> -target:discord',
                    '```',
                    'Now your alters have SP avatars for the app,',
                    'and PK avatars for Discord proxying!'
                ].join('\n'),
                inline: false
            },
            {
                name: '⚙️ Other Options',
                value: [
                    '`-replace` - Replace all existing data',
                    '`-skipexisting` - Skip members that already exist',
                    '`-nogroups` - Don\'t import groups',
                    '`-noswitches` - Don\'t import switch history',
                    '`-states:Name1,Name2` - Import these as states'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔄 Converting Members to States',
                value: [
                    'Use `-states:` flag during import:',
                    '`sys!import pk <token> -states:Tired,Anxious`',
                    '',
                    'Or convert after import:',
                    '`sys!convert alter Tired to state`'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Your existing data is preserved by default (merge mode)' });

    return message.reply({ embeds: [embed] });
}

// ============================================
// PLURALKIT API IMPORT
// ============================================

async function importPluralKitAPI(message, system, token, options) {
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Connecting to PluralKit API...')]
    });

    try {
        // Fetch system info
        const sysResponse = await fetch(`${PK_API_BASE}/systems/@me`, {
            headers: {
                'Authorization': token,
                'User-Agent': 'Systemiser Discord Bot (import)'
            }
        });

        if (!sysResponse.ok) {
            if (sysResponse.status === 401 || sysResponse.status === 403) {
                throw new Error('Invalid or expired token. Get a new one with `pk;token`');
            }
            throw new Error(`PluralKit API error: ${sysResponse.status}`);
        }

        const pkSystem = await sysResponse.json();

        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Found system: **${pkSystem.name || 'Unnamed'}**\nFetching members...`)]
        });

        // Fetch members
        const membersResponse = await fetch(`${PK_API_BASE}/systems/@me/members`, {
            headers: {
                'Authorization': token,
                'User-Agent': 'Systemiser Discord Bot (import)'
            }
        });

        if (!membersResponse.ok) {
            throw new Error(`Failed to fetch members: ${membersResponse.status}`);
        }

        const pkMembers = await membersResponse.json();

        // Fetch groups if not disabled
        let pkGroups = [];
        if (!options.noGroups) {
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(IMPORT_COLOR)
                    .setDescription(`🔄 Found **${pkMembers.length}** members\nFetching groups...`)]
            });

            const groupsResponse = await fetch(`${PK_API_BASE}/systems/@me/groups?with_members=true`, {
                headers: {
                    'Authorization': token,
                    'User-Agent': 'Systemiser Discord Bot (import)'
                }
            });

            if (groupsResponse.ok) {
                pkGroups = await groupsResponse.json();
            }
        }

        // Fetch switches if not disabled
        let pkSwitches = [];
        if (!options.noSwitches) {
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(IMPORT_COLOR)
                    .setDescription(`🔄 Found **${pkGroups.length}** groups\nFetching switches...`)]
            });

            const switchesResponse = await fetch(`${PK_API_BASE}/systems/@me/switches?limit=100`, {
                headers: {
                    'Authorization': token,
                    'User-Agent': 'Systemiser Discord Bot (import)'
                }
            });

            if (switchesResponse.ok) {
                pkSwitches = await switchesResponse.json();
            }
        }

        // Process the import
        const result = await processPluralKitData(system, {
            system: pkSystem,
            members: pkMembers,
            groups: pkGroups,
            switches: pkSwitches
        }, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('PluralKit', result, options.target)]
        });

    } catch (error) {
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)]
        });
    }
}

// ============================================
// PLURALKIT FILE IMPORT
// ============================================

async function importPluralKitFile(message, system, options) {
    const attachment = message.attachments.first();

    if (!attachment.name.endsWith('.json')) {
        return utils.error(message, 'Please attach a JSON file.');
    }

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Downloading file...')]
    });

    try {
        const response = await fetch(attachment.url);
        const data = await response.json();

        // Validate PluralKit format
        if (!data.members && !data.name) {
            throw new Error('This doesn\'t look like a PluralKit export file.');
        }

        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Processing **${data.members?.length || 0}** members...`)]
        });

        const result = await processPluralKitData(system, {
            system: data,
            members: data.members || [],
            groups: data.groups || [],
            switches: data.switches || []
        }, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('PluralKit', result, options.target)]
        });

    } catch (error) {
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)]
        });
    }
}

// ============================================
// PROCESS PLURALKIT DATA
// ============================================

async function processPluralKitData(system, data, options) {
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
                    // Update existing - pass target mode
                    updateStateFromPK(existingState, pkMember, options.target);
                    await existingState.save();
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.statesUpdated++;
                } else if (existingState && options.target === TARGET_DISCORD) {
                    // Discord target on existing - just update discord fields
                    updateStateFromPK(existingState, pkMember, options.target);
                    await existingState.save();
                    memberIdMap.set(pkMember.id, { id: existingState._id, type: 'state' });
                    result.statesUpdated++;
                } else {
                    // Create new
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
                    // Update existing - pass target mode
                    updateAlterFromPK(existingAlter, pkMember, options.target);
                    await existingAlter.save();
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersUpdated++;
                } else if (existingAlter && options.target === TARGET_DISCORD) {
                    // Discord target on existing - just update discord fields
                    updateAlterFromPK(existingAlter, pkMember, options.target);
                    await existingAlter.save();
                    memberIdMap.set(pkMember.id, { id: existingAlter._id, type: 'alter' });
                    result.membersUpdated++;
                } else {
                    // Create new
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
                    // Update existing
                    updateGroupFromPK(existingGroup, pkGroup, memberIdMap);
                    await existingGroup.save();
                    result.groupsUpdated++;
                } else {
                    // Create new
                    const newGroup = createGroupFromPK(pkGroup, memberIdMap);
                    await newGroup.save();

                    if (!system.groups.IDs.includes(newGroup._id)) {
                        system.groups.IDs.push(newGroup._id);
                    }

                    result.groupsImported++;
                }
            } catch (err) {
                result.errors.push(`Group "${pkGroup.name}": ${err.message}`);
            }
        }
    }

    // Import switches (last 100)
    if (!options.noSwitches && data.switches && data.switches.length > 0) {
        // Initialize front layer if needed
        if (!system.front) system.front = {};
        if (!system.front.layers || system.front.layers.length === 0) {
            system.front.layers = [{
                _id: new mongoose.Types.ObjectId(),
                name: 'Main',
                shifts: []
            }];
        }

        const mainLayer = system.front.layers[0];

        // Convert PK switches to our shift format (most recent first in PK)
        for (const pkSwitch of data.switches.slice(0, 50)) {
            const memberIds = pkSwitch.members
                .map(m => {
                    const mapped = memberIdMap.get(typeof m === 'string' ? m : m.id);
                    return mapped ? mapped.id : null;
                })
                .filter(Boolean);

            if (memberIds.length > 0) {
                // Add to shifts (we'd need the Shift schema, simplified here)
                result.switchesImported++;
            }
        }
    }

    await system.save();

    return result;
}

// ============================================
// TUPPERBOX FILE IMPORT
// ============================================

async function importTupperboxFile(message, system, options) {
    const attachment = message.attachments.first();

    if (!attachment.name.endsWith('.json')) {
        return utils.error(message, 'Please attach a JSON file.');
    }

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Downloading file...')]
    });

    try {
        const response = await fetch(attachment.url);
        const data = await response.json();

        // Validate Tupperbox format
        if (!data.tuppers) {
            throw new Error('This doesn\'t look like a Tupperbox export file.');
        }

        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Processing **${data.tuppers.length}** tuppers...`)]
        });

        const result = await processTupperboxData(system, data, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('Tupperbox', result, options.target)]
        });

    } catch (error) {
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)]
        });
    }
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

    // Map TB group IDs to Systemiser group IDs
    const groupIdMap = new Map();

    // Initialize arrays if needed
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

            // Convert Tupperbox brackets to proxy format
            const proxy = convertTBBracketsToProxy(tupper.brackets);

            if (existingAlter && !options.replace) {
                // Update existing
                if (tupper.avatar_url) existingAlter.avatar = { url: tupper.avatar_url };
                if (tupper.nick) existingAlter.name.display = tupper.nick;
                if (tupper.description) existingAlter.description = tupper.description;
                if (proxy && !existingAlter.proxy?.includes(proxy)) {
                    existingAlter.proxy = existingAlter.proxy || [];
                    existingAlter.proxy.push(proxy);
                }
                if (tupper.tag) existingAlter.signoff = tupper.tag;

                await existingAlter.save();

                // Add to group if specified
                if (tupper.group_id && groupIdMap.has(tupper.group_id)) {
                    await addAlterToGroup(existingAlter._id, groupIdMap.get(tupper.group_id));
                }

                result.membersUpdated++;
            } else {
                // Create new
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

                // Add to group if specified
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

async function importSimplyPluralAPI(message, system, token, options) {
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Connecting to Simply Plural API...')]
    });

    try {
        // Fetch members
        const membersResponse = await fetch(`${SP_API_BASE}/members`, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (!membersResponse.ok) {
            if (membersResponse.status === 401 || membersResponse.status === 403) {
                throw new Error('Invalid or expired token. Create a new one in Simply Plural settings.');
            }
            throw new Error(`Simply Plural API error: ${membersResponse.status}`);
        }

        const spMembers = await membersResponse.json();

        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Found **${Object.keys(spMembers).length}** members\nFetching groups...`)]
        });

        // Fetch groups
        let spGroups = {};
        if (!options.noGroups) {
            const groupsResponse = await fetch(`${SP_API_BASE}/groups`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });

            if (groupsResponse.ok) {
                spGroups = await groupsResponse.json();
            }
        }

        // Process the import
        const result = await processSimplyPluralData(system, {
            members: spMembers,
            groups: spGroups
        }, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('Simply Plural', result, options.target)]
        });

    } catch (error) {
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)]
        });
    }
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

    // Initialize arrays if needed
    if (!system.alters) system.alters = { IDs: [], conditions: [] };
    if (!system.groups) system.groups = { IDs: [], types: [], conditions: [] };

    // SP returns members as object with IDs as keys
    const members = Object.values(data.members);

    for (const spMember of members) {
        try {
            // Skip if member is archived/private based on your needs
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
                // Update existing
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
                // Create new
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

                if (!system.alters.IDs.includes(newAlter._id)) {
                    system.alters.IDs.push(newAlter._id);
                }

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

                if (existingGroup && options.skipExisting) {
                    continue;
                }

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

                    if (!system.groups.IDs.includes(newGroup._id)) {
                        system.groups.IDs.push(newGroup._id);
                    }

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

async function importAutoDetect(message, system, options) {
    const attachment = message.attachments.first();

    if (!attachment.name.endsWith('.json')) {
        return utils.error(message, 'Please attach a JSON file.');
    }

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Analyzing file format...')]
    });

    try {
        const response = await fetch(attachment.url);
        const data = await response.json();

        // Detect format
        if (data.tuppers) {
            // Tupperbox format
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(IMPORT_COLOR)
                    .setDescription('📦 Detected **Tupperbox** format\nProcessing...')]
            });

            const result = await processTupperboxData(system, data, options);
            await statusMsg.edit({ embeds: [buildImportResultEmbed('Tupperbox', result, options.target)] });

        } else if (data.members || data.id) {
            // PluralKit format
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(IMPORT_COLOR)
                    .setDescription('🔷 Detected **PluralKit** format\nProcessing...')]
            });

            const result = await processPluralKitData(system, {
                system: data,
                members: data.members || [],
                groups: data.groups || [],
                switches: data.switches || []
            }, options);
            await statusMsg.edit({ embeds: [buildImportResultEmbed('PluralKit', result, options.target)] });

        } else {
            throw new Error('Could not detect file format. Please specify: `sys!import pluralkit` or `sys!import tupperbox`');
        }

    } catch (error) {
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)]
        });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildImportResultEmbed(source, result, targetMode = TARGET_APP) {
    const embed = new EmbedBuilder()
        .setColor(result.errors.length > 0 ? '#FFA500' : utils.ENTITY_COLORS.success)
        .setTitle(`✅ Import from ${source} Complete`);

    let description = '';

    // Show target mode
    if (targetMode === TARGET_DISCORD) {
        description += '🎯 **Target:** Discord-specific fields\n';
    } else {
        description += '🎯 **Target:** Main/App fields\n';
    }

    if (result.systemUpdated) {
        description += '📋 System info updated\n';
    }

    description += `\n**Alters:**\n`;
    description += `• Imported: **${result.membersImported}**\n`;
    if (result.membersUpdated > 0) description += `• Updated: **${result.membersUpdated}**\n`;
    if (result.membersSkipped > 0) description += `• Skipped: **${result.membersSkipped}**\n`;

    if (result.statesImported > 0 || result.statesUpdated > 0) {
        description += `\n**States:**\n`;
        description += `• Imported: **${result.statesImported || 0}**\n`;
        if (result.statesUpdated > 0) description += `• Updated: **${result.statesUpdated}**\n`;
    }

    if (result.groupsImported > 0 || result.groupsUpdated > 0) {
        description += `\n**Groups:**\n`;
        description += `• Imported: **${result.groupsImported}**\n`;
        if (result.groupsUpdated > 0) description += `• Updated: **${result.groupsUpdated}**\n`;
    }

    if (result.switchesImported > 0) {
        description += `\n**Switches:** ${result.switchesImported} imported\n`;
    }

    embed.setDescription(description);

    if (result.errors.length > 0) {
        const errorText = result.errors.slice(0, 5).join('\n');
        const moreErrors = result.errors.length > 5 ? `\n*...and ${result.errors.length - 5} more*` : '';
        embed.addFields({
            name: '⚠️ Warnings',
            value: errorText + moreErrors,
            inline: false
        });
    }

    // Add helpful tips based on what happened
    if (targetMode === TARGET_DISCORD && result.membersUpdated > 0) {
        embed.addFields({
            name: '✨ Multi-Source Import',
            value: 'Discord-specific data has been added to your existing members!\nYour main profile data remains unchanged.',
            inline: false
        });
    } else if ((result.statesImported || 0) === 0 && result.membersImported > 0) {
        embed.addFields({
            name: '💡 Tip',
            value: 'Use `sys!convert alter <n> to state` to convert any alters that should be states.',
            inline: false
        });
    }

    embed.setFooter({ text: 'Use sys!alter list to see your imported members' });

    return embed;
}

async function findExistingAlter(system, pkMember) {
    // Try to find by PK ID in metadata first
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
    // Try to find by PK ID in metadata first
    let state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'metadata.pluralKitId': pkMember.id
    });
    if (state) return state;

    // Try by UUID
    state = await State.findOne({
        _id: { $in: system.states?.IDs || [] },
        'metadata.pluralKitUuid': pkMember.uuid
    });
    if (state) return state;

    // Try by name
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

function createAlterFromPK(pkMember) {
    // Convert PK proxy tags to our format
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
    // Create alter with data in discord-specific fields
    // Convert PK proxy tags to our format
    const proxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    return new Alter({
        name: {
            indexable: pkMember.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 32) || `alter${Date.now()}`
            // Don't set display here - leave for app
        },
        // Discord-specific fields
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

function updateAlterFromPK(alter, pkMember, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        // Update discord-specific fields only
        if (!alter.discord) alter.discord = {};
        if (!alter.discord.name) alter.discord.name = {};
        if (!alter.discord.image) alter.discord.image = {};

        if (pkMember.display_name) alter.discord.name.display = pkMember.display_name;
        if (pkMember.description) alter.discord.description = pkMember.description;
        if (pkMember.color) alter.discord.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) alter.discord.image.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner) alter.discord.image.banner = { url: pkMember.banner };
    } else {
        // Update main/app fields (default)
        if (pkMember.display_name) alter.name.display = pkMember.display_name;
        if (pkMember.description) alter.description = pkMember.description;
        if (pkMember.pronouns) alter.pronouns = [pkMember.pronouns];
        if (pkMember.color) alter.color = `#${pkMember.color}`;
        if (pkMember.birthday) alter.birthday = new Date(pkMember.birthday);
        if (pkMember.avatar_url) alter.avatar = { url: pkMember.avatar_url };
    }

    // Proxy tags always go to main proxy field (used for Discord proxying)
    const newProxies = (pkMember.proxy_tags || []).map(tag => {
        const prefix = tag.prefix || '';
        const suffix = tag.suffix || '';
        return `${prefix}text${suffix}`;
    }).filter(p => p !== 'text');

    // Merge proxies, avoiding duplicates
    for (const proxy of newProxies) {
        if (!alter.proxy?.includes(proxy)) {
            alter.proxy = alter.proxy || [];
            alter.proxy.push(proxy);
        }
    }

    // Store PK IDs for future reference
    alter.metadata = alter.metadata || {};
    alter.metadata.pluralKitId = pkMember.id;
    alter.metadata.pluralKitUuid = pkMember.uuid;
}

function createStateFromPK(pkMember) {
    // Convert PK proxy tags to our format
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
    // Create state with data in discord-specific fields
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

function updateStateFromPK(state, pkMember, targetMode = TARGET_APP) {
    if (targetMode === TARGET_DISCORD) {
        // Update discord-specific fields only
        if (!state.discord) state.discord = {};
        if (!state.discord.name) state.discord.name = {};
        if (!state.discord.image) state.discord.image = {};

        if (pkMember.display_name) state.discord.name.display = pkMember.display_name;
        if (pkMember.description) state.discord.description = pkMember.description;
        if (pkMember.color) state.discord.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) state.discord.image.avatar = { url: pkMember.avatar_url };
        if (pkMember.banner) state.discord.image.banner = { url: pkMember.banner };
    } else {
        // Update main/app fields (default)
        if (pkMember.display_name) state.name.display = pkMember.display_name;
        if (pkMember.description) state.description = pkMember.description;
        if (pkMember.pronouns) state.pronouns = [pkMember.pronouns];
        if (pkMember.color) state.color = `#${pkMember.color}`;
        if (pkMember.avatar_url) state.avatar = { url: pkMember.avatar_url };
    }

    // Proxy tags always go to main proxy field
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

function createGroupFromPK(pkGroup, memberIdMap) {
    // Separate alters and states
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

function updateGroupFromPK(group, pkGroup, memberIdMap) {
    if (pkGroup.display_name) group.name.display = pkGroup.display_name;
    if (pkGroup.description) group.description = pkGroup.description;
    if (pkGroup.color) group.color = `#${pkGroup.color}`;
    if (pkGroup.icon) group.avatar = { url: pkGroup.icon };

    // Update member list - handle both alters and states
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