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

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');
const importFunctions = require('../../functions/import_functions');

const {
    TARGET_APP,
    TARGET_DISCORD,
    IMPORT_COLOR,
    parsePluralKitUrl,
    importPluralKitAPI,
    importPluralKitFile,
    importTupperboxFile,
    importSimplyPluralAPI,
    importAutoDetect,
    createBackup,
} = importFunctions;

// Octocon: TODO — add Octocon as an import source (file + API)

module.exports = {
    name: 'import',
    aliases: ['imp'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const source = parsed._positional[0]?.toLowerCase();

        // Show help if no args
        if (!source && message.attachments.size === 0)
            return handleHelp(message);

        // Get or create user and system
        let { user, system } = await utils.getOrCreateUserAndSystem(message);

        if (!system) {
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
        let targetMode = TARGET_APP;
        if (parsed.target) {
            const t = parsed.target.toLowerCase();
            if (t === 'discord' || t === 'dc') targetMode = TARGET_DISCORD;
            else if (t === 'app' || t === 'main') targetMode = TARGET_APP;
            else return utils.error(message, `Invalid target: \`${parsed.target}\`\nUse \`-target:app\` or \`-target:discord\``);
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
                if (token) return await handlePKAPI(message, system, user, token, options);
                else if (message.attachments.size > 0) return await handlePKFile(message, system, user, options);
                else return utils.error(message, 'Please provide a PluralKit token or attach an export file.\n\nGet your token: DM PluralKit with `pk;token`\nOr export: `pk;export` and attach the file');
            }

            if (source === 'tupperbox' || source === 'tb' || source === 'tupper') {
                if (message.attachments.size > 0) return await handleTBFile(message, system, user, options);
                else return utils.error(message, 'Please attach a Tupperbox export file.\n\nExport with: `tul!export`');
            }

            if (source === 'simplyplural' || source === 'sp') {
                const token = parsed._positional[1];
                if (token) return await handleSPAPI(message, system, user, token, options);
                else return utils.error(message, 'Please provide a Simply Plural API token.\n\nGet your token: Settings → Developer → Add Token (Read permission)');
            }

            // Auto-detect from attached file
            if (message.attachments.size > 0) return await handleAutoDetect(message, system, user, options);

            return utils.error(message, `Unknown import source: \`${source}\`\nSupported: \`pluralkit\`, \`tupperbox\`, \`simplyplural\`\n\nUse \`sys!import\` for help.`);

        } catch (error) {
            console.error('Import error:', error);
            return utils.error(message, `Import failed: ${error.message}`);
        }
    }
};

// ============================================
// HANDLERS — Discord-specific UI wrapping
// ============================================

async function handlePKAPI(message, system, user, token, options) {
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Connecting to PluralKit API...')]
    });

    try {
        // Backup before import
        await createBackup(system, 'pluralkit');
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription('🔄 Backup saved. Fetching data from PluralKit...')]
        });

        const result = await importPluralKitAPI(system, user, token, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('PluralKit', result, options.target)]
        });
    } catch (error) {
        if (error.message?.includes('Invalid or expired token')) {
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(utils.ENTITY_COLORS.error)
                    .setDescription('❌ Invalid or expired PluralKit token.\n\nGet a new one with `pk;token`')]
            });
        } else {
            await statusMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(utils.ENTITY_COLORS.error)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
}

async function handlePKFile(message, system, user, options) {
    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.json'))
        return utils.error(message, 'Please attach a JSON file.');

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Downloading file...')]
    });

    try {
        const response = await fetch(attachment.url);
        const fileData = await response.json();

        await createBackup(system, 'pluralkit');
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Processing **${fileData.members?.length || 0}** members...`)]
        });

        const result = await importPluralKitFile(system, user, fileData, options);

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

async function handleTBFile(message, system, user, options) {
    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.json'))
        return utils.error(message, 'Please attach a JSON file.');

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Downloading file...')]
    });

    try {
        const response = await fetch(attachment.url);
        const fileData = await response.json();

        await createBackup(system, 'tupperbox');
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Processing **${fileData.tuppers?.length || 0}** tuppers...`)]
        });

        const result = await importTupperboxFile(system, user, fileData, options);

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

async function handleSPAPI(message, system, user, token, options) {
    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Connecting to Simply Plural API...')]
    });

    try {
        await createBackup(system, 'simplyplural');
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription('🔄 Backup saved. Fetching data from Simply Plural...')]
        });

        const result = await importSimplyPluralAPI(system, user, token, options);

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

async function handleAutoDetect(message, system, user, options) {
    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.json'))
        return utils.error(message, 'Please attach a JSON file.');

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setDescription('🔄 Analyzing file format...')]
    });

    try {
        const response = await fetch(attachment.url);
        const fileData = await response.json();

        await createBackup(system, 'auto');

        // Detect source for backup label
        const source = fileData.tuppers ? 'Tupperbox' : (fileData.members || fileData.id) ? 'PluralKit' : 'Unknown';
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Detected **${source}** format\nProcessing...`)]
        });

        const result = await importAutoDetect(system, user, fileData, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed(source, result, options.target)]
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
            // Octocon: TODO — add Octocon import option here
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
// RESULT EMBED BUILDER
// ============================================

function buildImportResultEmbed(source, result, targetMode = TARGET_APP) {
    const embed = new EmbedBuilder()
        .setColor(result.errors.length > 0 ? '#FFA500' : utils.ENTITY_COLORS.success)
        .setTitle(`✅ Import from ${source} Complete`);

    let description = '';

    // Show target mode
    if (targetMode === TARGET_DISCORD) description += '🎯 **Target:** Discord-specific fields\n';
    else description += '🎯 **Target:** Main/App fields\n';

    if (result.systemUpdated) description += '📋 Profile info updated\n';
    if (result.pronounsApplied) description += '💬 System pronouns applied to your profile\n';

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

    if (result.switchesImported > 0)
        description += `\n**Switches:** ${result.switchesImported} imported\n`;

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
            value: 'All members imported as **alters**. Convert any to states with:\n`sys!convert alter <name> to state`',
            inline: false
        });
    }

    embed.setFooter({ text: 'Use sys!alter list to see your imported members' });

    return embed;
}
