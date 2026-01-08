// sys!convert - Convert entities between types (alter <-> state)
// 
// USAGE:
//   sys!convert alter <name> to state       - Convert an alter to a state
//   sys!convert state <name> to alter       - Convert a state to an alter
//   sys!convert alters <n1,n2,n3> to states - Batch convert alters to states
//   sys!convert states <n1,n2,n3> to alters - Batch convert states to alters
//
// FLAGS:
//   -confirm                                - Skip confirmation prompt
//   -keep                                   - Keep original (creates copy)
//
// NOTES:
//   - Most fields transfer directly (name, description, avatar, pronouns, color, etc.)
//   - Proxy tags transfer directly
//   - Group memberships are preserved where applicable
//   - Alter-specific fields (like dormancy) become state-specific equivalents (remission)
//   - The original entity is deleted unless -keep is used

const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

const CONVERT_COLOR = '#007bd8'; 

module.exports = {
    name: 'convert',
    aliases: ['conv', 'transform'],

    async executeMessage(message, args) {
        const { user, system } = await utils.getOrCreateUserAndSystem(message);

        if (!system) {
            return utils.error(message, 'You need a system to convert entities. Use `sys!system new` to create one.');
        }

        const parsed = utils.parseArgs(args);

        // Parse: convert <type> <name> to <targetType>
        // Or: convert <type>s <name1,name2> to <targetType>s
        const sourceType = parsed._positional[0]?.toLowerCase();

        if (!sourceType || sourceType === 'help') {
            return handleHelp(message);
        }

        // Check for batch conversion (alters/states plural)
        const isBatch = sourceType === 'alters' || sourceType === 'states';
        const normalizedSourceType = sourceType.replace(/s$/, ''); // Remove trailing 's'

        if (!['alter', 'state'].includes(normalizedSourceType)) {
            return utils.error(message, `Invalid source type: \`${sourceType}\`\nUse \`alter\` or \`state\` (or \`alters\`/\`states\` for batch).`);
        }

        // Find "to" keyword
        const toIndex = parsed._positional.findIndex(p => p.toLowerCase() === 'to');
        if (toIndex === -1) {
            return utils.error(message, 'Missing `to` keyword.\nUsage: `sys!convert alter <name> to state`');
        }

        // Get names (everything between source type and "to")
        const namesPart = parsed._positional.slice(1, toIndex).join(' ');
        if (!namesPart) {
            return utils.error(message, `Please specify the ${normalizedSourceType} name(s) to convert.`);
        }

        // Get target type
        let targetType = parsed._positional[toIndex + 1]?.toLowerCase();
        if (!targetType) {
            return utils.error(message, 'Please specify the target type (alter or state).');
        }
        targetType = targetType.replace(/s$/, ''); // Remove trailing 's'

        if (!['alter', 'state'].includes(targetType)) {
            return utils.error(message, `Invalid target type: \`${targetType}\`\nUse \`alter\` or \`state\`.`);
        }

        if (normalizedSourceType === targetType) {
            return utils.error(message, `Cannot convert ${normalizedSourceType} to ${targetType} - they're the same type!`);
        }

        // Parse names (comma-separated for batch, or single name)
        const names = isBatch
            ? namesPart.split(',').map(n => n.trim()).filter(Boolean)
            : [namesPart];

        // Options
        const options = {
            confirm: parsed.confirm || false,
            keep: parsed.keep || false
        };

        // Process conversion
        if (normalizedSourceType === 'alter' && targetType === 'state') {
            return convertAltersToStates(message, system, names, options);
        } else {
            return convertStatesToAlters(message, system, names, options);
        }
    }
};

// ============================================
// HELP
// ============================================

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(CONVERT_COLOR)
        .setTitle('🔄 Convert Command')
        .setDescription('Convert entities between alters and states.')
        .addFields(
            {
                name: 'Single Conversion',
                value: [
                    '`sys!convert alter <name> to state`',
                    '`sys!convert state <name> to alter`'
                ].join('\n'),
                inline: false
            },
            {
                name: 'Batch Conversion',
                value: [
                    '`sys!convert alters <n1,n2,n3> to states`',
                    '`sys!convert states <n1,n2,n3> to alters`'
                ].join('\n'),
                inline: false
            },
            {
                name: 'Options',
                value: [
                    '`-confirm` - Skip confirmation prompt',
                    '`-keep` - Keep original (creates a copy instead)'
                ].join('\n'),
                inline: false
            },
            {
                name: 'What Transfers',
                value: [
                    '✅ Name, display name, description',
                    '✅ Avatar, banner, color',
                    '✅ Pronouns, birthday',
                    '✅ Proxy tags',
                    '✅ Group memberships',
                    '✅ Privacy settings',
                    '🔄 Dormancy ↔ Remission status'
                ].join('\n'),
                inline: false
            },
            {
                name: '💡 Tip',
                value: 'Use this after importing from PluralKit/Tupperbox to convert members that should be states!',
                inline: false
            }
        );

    return message.reply({ embeds: [embed] });
}

// ============================================
// ALTER → STATE
// ============================================

async function convertAltersToStates(message, system, names, options) {
    const results = {
        converted: [],
        notFound: [],
        errors: []
    };

    // Find all alters first
    const altersToConvert = [];
    for (const name of names) {
        const alter = await Alter.findOne({
            _id: { $in: system.alters?.IDs || [] },
            $or: [
                { 'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(name)}$`, 'i') } },
                { 'name.display': { $regex: new RegExp(`^${utils.escapeRegex(name)}$`, 'i') } }
            ]
        });

        if (alter) {
            altersToConvert.push(alter);
        } else {
            results.notFound.push(name);
        }
    }

    if (altersToConvert.length === 0) {
        return utils.error(message, `No alters found matching: ${names.join(', ')}`);
    }

    // Confirmation prompt (unless -confirm flag)
    if (!options.confirm) {
        const alterNames = altersToConvert.map(a => a.name?.display || a.name?.indexable).join(', ');
        const embed = new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setTitle('🔄 Convert Alters to States?')
            .setDescription(`This will convert **${altersToConvert.length}** alter(s) to states:\n${alterNames}`)
            .addFields({
                name: options.keep ? '📋 Mode: Copy' : '⚠️ Mode: Convert',
                value: options.keep
                    ? 'Original alters will be kept (copies created as states)'
                    : 'Original alters will be **deleted** after conversion',
                inline: false
            })
            .setFooter({ text: 'Add -confirm to skip this prompt' });

        const confirmMsg = await message.reply({ embeds: [embed] });

        // Wait for confirmation
        const filter = m => m.author.id === message.author.id &&
            ['yes', 'y', 'confirm', 'no', 'n', 'cancel'].includes(m.content.toLowerCase());

        try {
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const response = collected.first().content.toLowerCase();

            if (['no', 'n', 'cancel'].includes(response)) {
                return confirmMsg.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(utils.ENTITY_COLORS.error)
                        .setDescription('❌ Conversion cancelled.')]
                });
            }
        } catch {
            return confirmMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(utils.ENTITY_COLORS.error)
                    .setDescription('❌ Conversion timed out.')]
            });
        }
    }

    // Process conversions
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setDescription(`🔄 Converting ${altersToConvert.length} alter(s) to states...`)]
    });

    for (const alter of altersToConvert) {
        try {
            // Create new state from alter data
            const newState = new State({
                name: {
                    indexable: alter.name?.indexable,
                    display: alter.name?.display,
                    closedNameDisplay: alter.name?.closedNameDisplay
                },
                description: alter.description,
                pronouns: alter.pronouns,
                birthday: alter.birthday,
                color: alter.color,
                avatar: alter.avatar,
                banner: alter.banner,
                proxy: alter.proxy || [],
                signoff: alter.signoff,

                // Convert dormancy to remission
                remission: alter.dormancy ? {
                    isRemission: alter.dormancy.isDormant || false,
                    since: alter.dormancy.since,
                    reason: alter.dormancy.reason
                } : undefined,

                // Preserve group memberships
                groupsIDs: alter.groupsIDs || [],

                // Preserve alter IDs this state can be linked to
                alterIDs: alter.stateIDs || [],

                // Privacy
                setting: alter.setting,

                // Metadata
                metadata: {
                    addedAt: alter.metadata?.addedAt || new Date(),
                    convertedFrom: 'alter',
                    convertedAt: new Date(),
                    originalId: alter._id,
                    // Preserve import metadata
                    importedFrom: alter.metadata?.importedFrom,
                    pluralKitId: alter.metadata?.pluralKitId,
                    pluralKitUuid: alter.metadata?.pluralKitUuid
                }
            });

            await newState.save();

            // Add state to system
            if (!system.states) system.states = { IDs: [], conditions: [] };
            system.states.IDs.push(newState._id);

            // Update groups to include new state
            if (alter.groupsIDs?.length > 0) {
                for (const groupId of alter.groupsIDs) {
                    const group = await Group.findById(groupId);
                    if (group) {
                        if (!group.stateIDs) group.stateIDs = [];
                        group.stateIDs.push(newState._id);
                        await group.save();
                    }
                }
            }

            // Remove alter (unless -keep)
            if (!options.keep) {
                // Remove from system
                system.alters.IDs = system.alters.IDs.filter(id => id.toString() !== alter._id.toString());

                // Remove from groups
                if (alter.groupsIDs?.length > 0) {
                    for (const groupId of alter.groupsIDs) {
                        const group = await Group.findById(groupId);
                        if (group && group.memberIDs) {
                            group.memberIDs = group.memberIDs.filter(id => id.toString() !== alter._id.toString());
                            await group.save();
                        }
                    }
                }

                // Delete alter
                await Alter.findByIdAndDelete(alter._id);
            }

            results.converted.push(alter.name?.display || alter.name?.indexable);

        } catch (err) {
            results.errors.push(`${alter.name?.display || alter.name?.indexable}: ${err.message}`);
        }
    }

    await system.save();

    // Build result embed
    const embed = buildResultEmbed('Alter → State', results, options.keep);
    await statusMsg.edit({ embeds: [embed] });
}

// ============================================
// STATE → ALTER
// ============================================

async function convertStatesToAlters(message, system, names, options) {
    const results = {
        converted: [],
        notFound: [],
        errors: []
    };

    // Find all states first
    const statesToConvert = [];
    for (const name of names) {
        const state = await State.findOne({
            _id: { $in: system.states?.IDs || [] },
            $or: [
                { 'name.indexable': { $regex: new RegExp(`^${utils.escapeRegex(name)}$`, 'i') } },
                { 'name.display': { $regex: new RegExp(`^${utils.escapeRegex(name)}$`, 'i') } }
            ]
        });

        if (state) {
            statesToConvert.push(state);
        } else {
            results.notFound.push(name);
        }
    }

    if (statesToConvert.length === 0) {
        return utils.error(message, `No states found matching: ${names.join(', ')}`);
    }

    // Confirmation prompt (unless -confirm flag)
    if (!options.confirm) {
        const stateNames = statesToConvert.map(s => s.name?.display || s.name?.indexable).join(', ');
        const embed = new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setTitle('🔄 Convert States to Alters?')
            .setDescription(`This will convert **${statesToConvert.length}** state(s) to alters:\n${stateNames}`)
            .addFields({
                name: options.keep ? '📋 Mode: Copy' : '⚠️ Mode: Convert',
                value: options.keep
                    ? 'Original states will be kept (copies created as alters)'
                    : 'Original states will be **deleted** after conversion',
                inline: false
            })
            .setFooter({ text: 'Add -confirm to skip this prompt' });

        const confirmMsg = await message.reply({ embeds: [embed] });

        const filter = m => m.author.id === message.author.id &&
            ['yes', 'y', 'confirm', 'no', 'n', 'cancel'].includes(m.content.toLowerCase());

        try {
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const response = collected.first().content.toLowerCase();

            if (['no', 'n', 'cancel'].includes(response)) {
                return confirmMsg.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(utils.ENTITY_COLORS.error)
                        .setDescription('❌ Conversion cancelled.')]
                });
            }
        } catch {
            return confirmMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(utils.ENTITY_COLORS.error)
                    .setDescription('❌ Conversion timed out.')]
            });
        }
    }

    // Process conversions
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setDescription(`🔄 Converting ${statesToConvert.length} state(s) to alters...`)]
    });

    for (const state of statesToConvert) {
        try {
            // Create new alter from state data
            const newAlter = new Alter({
                name: {
                    indexable: state.name?.indexable,
                    display: state.name?.display,
                    closedNameDisplay: state.name?.closedNameDisplay
                },
                description: state.description,
                pronouns: state.pronouns,
                birthday: state.birthday,
                color: state.color,
                avatar: state.avatar,
                banner: state.banner,
                proxy: state.proxy || [],
                signoff: state.signoff,

                // Convert remission to dormancy
                dormancy: state.remission ? {
                    isDormant: state.remission.isRemission || false,
                    since: state.remission.since,
                    reason: state.remission.reason
                } : undefined,

                // Preserve group memberships
                groupsIDs: state.groupsIDs || [],

                // Preserve state IDs this alter can be linked to
                stateIDs: state.alterIDs || [],

                // Privacy
                setting: state.setting,

                // Metadata
                metadata: {
                    addedAt: state.metadata?.addedAt || new Date(),
                    convertedFrom: 'state',
                    convertedAt: new Date(),
                    originalId: state._id,
                    // Preserve import metadata
                    importedFrom: state.metadata?.importedFrom,
                    pluralKitId: state.metadata?.pluralKitId,
                    pluralKitUuid: state.metadata?.pluralKitUuid
                }
            });

            await newAlter.save();

            // Add alter to system
            if (!system.alters) system.alters = { IDs: [], conditions: [] };
            system.alters.IDs.push(newAlter._id);

            // Update groups to include new alter
            if (state.groupsIDs?.length > 0) {
                for (const groupId of state.groupsIDs) {
                    const group = await Group.findById(groupId);
                    if (group) {
                        if (!group.memberIDs) group.memberIDs = [];
                        group.memberIDs.push(newAlter._id);
                        await group.save();
                    }
                }
            }

            // Remove state (unless -keep)
            if (!options.keep) {
                // Remove from system
                system.states.IDs = system.states.IDs.filter(id => id.toString() !== state._id.toString());

                // Remove from groups
                if (state.groupsIDs?.length > 0) {
                    for (const groupId of state.groupsIDs) {
                        const group = await Group.findById(groupId);
                        if (group && group.stateIDs) {
                            group.stateIDs = group.stateIDs.filter(id => id.toString() !== state._id.toString());
                            await group.save();
                        }
                    }
                }

                // Delete state
                await State.findByIdAndDelete(state._id);
            }

            results.converted.push(state.name?.display || state.name?.indexable);

        } catch (err) {
            results.errors.push(`${state.name?.display || state.name?.indexable}: ${err.message}`);
        }
    }

    await system.save();

    // Build result embed
    const embed = buildResultEmbed('State → Alter', results, options.keep);
    await statusMsg.edit({ embeds: [embed] });
}

// ============================================
// HELPERS
// ============================================

function buildResultEmbed(conversionType, results, keepOriginal) {
    const embed = new EmbedBuilder()
        .setColor(results.errors.length > 0 ? '#FFA500' : utils.ENTITY_COLORS.success)
        .setTitle(`✅ ${conversionType} Conversion Complete`);

    let description = '';

    if (results.converted.length > 0) {
        description += `**${keepOriginal ? 'Copied' : 'Converted'}:** ${results.converted.join(', ')}\n`;
    }

    if (results.notFound.length > 0) {
        description += `\n**Not Found:** ${results.notFound.join(', ')}\n`;
    }

    embed.setDescription(description || 'No entities processed.');

    if (results.errors.length > 0) {
        embed.addFields({
            name: '⚠️ Errors',
            value: results.errors.slice(0, 5).join('\n'),
            inline: false
        });
    }

    return embed;
}