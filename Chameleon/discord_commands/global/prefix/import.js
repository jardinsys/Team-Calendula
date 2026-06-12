// sys!import - Import system data from other platforms
// Supports: PluralKit (file + API), Tupperbox (file), Simply Plural (API), Octocon (file + API)
//
// USAGE:
//   sys!import                           - Show help
//   sys!import pluralkit                 - Import via PluralKit API (opens modal for token)
//   sys!import pluralkit <file>          - Import from attached PK export file
//   sys!import tupperbox                 - Import from attached Tupperbox export file
//   sys!import simplyplural              - Import via SP API (opens modal for token)
//   sys!import octocon                   - Import via Octocon API (opens modal for system ID)
//   sys!import octocon <file>            - Import from attached Octocon export file
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
//   1. sys!import simplyplural           - Import SP data as main profile
//   2. sys!import pluralkit -target:discord - Add PK data as Discord overlay
//
// NOTE: Other platforms don't have "states" - all members import as alters by default.
//       Use -states: flag or sys!convert after import to change alters to states.

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
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
    parseOctoconId,
    importPluralKitAPI,
    importPluralKitFile,
    importTupperboxFile,
    importSimplyPluralAPI,
    importOctoconAPI,
    importOctoconFile,
    importAutoDetect,
    createBackup,
    getSourceEntityTerm,
    fetchPKMembers,
    fetchSPMembers,
    fetchOctoconAlters,
} = importFunctions;

module.exports = {
    name: 'import',
    aliases: ['imp'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const source = parsed._positional[0]?.toLowerCase();

        if (!source && message.attachments.size === 0)
            return handleHelp(message);

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

        let targetMode = TARGET_APP;
        if (parsed.target) {
            const t = parsed.target.toLowerCase();
            if (t === 'discord' || t === 'dc') targetMode = TARGET_DISCORD;
            else if (t === 'app' || t === 'main') targetMode = TARGET_APP;
            else return utils.error(message, `Invalid target: \`${parsed.target}\`\nUse \`-target:app\` or \`-target:discord\``);
        }

        const options = {
            replace: parsed.replace || false,
            skipExisting: parsed.skipexisting || false,
            noGroups: parsed.nogroups || false,
            noSwitches: parsed.noswitches || false,
            stateNames: parsed.states ? parsed.states.split(',').map(n => n.trim().toLowerCase()) : [],
            target: targetMode
        };

        const sessionId = utils.generateSessionId(message.author.id);

        utils.setSession(sessionId, {
            type: 'import',
            userId: message.author.id,
            systemId: system._id,
            sysType: system.sys_type || {},
            options,
            source
        });

        try {
            if (source === 'pluralkit' || source === 'pk') {
                if (message.attachments.size > 0) return await handlePKFile(message, system, user, options);
                return await showTokenButton(message, 'pluralkit', sessionId);
            }

            if (source === 'tupperbox' || source === 'tb' || source === 'tupper') {
                if (message.attachments.size > 0) return await handleTBFile(message, system, user, options);
                return utils.error(message, 'Please attach a Tupperbox export file.\n\nExport with: `tul!export`');
            }

            if (source === 'simplyplural' || source === 'sp') {
                return await showTokenButton(message, 'simplyplural', sessionId);
            }

            if (source === 'octocon' || source === 'oc') {
                if (message.attachments.size > 0) return await handleOctoconFile(message, system, user, options);
                return await showTokenButton(message, 'octocon', sessionId);
            }

            if (message.attachments.size > 0) return await handleAutoDetect(message, system, user, options);

            return utils.error(message, `Unknown import source: \`${source}\`\nSupported: \`pluralkit\`, \`tupperbox\`, \`simplyplural\`, \`octocon\`\n\nUse \`sys!import\` for help.`);

        } catch (error) {
            console.error('Import error:', error);
            return utils.error(message, `Import failed: ${error.message}`);
        }
    },

    // Handle button interactions
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;

        // Token entry button → show modal
        if (customId.startsWith('import_token_')) {
            const parts = customId.split('_');
            const source = parts[2];
            const sessionId = parts.slice(3).join('_');

            const session = utils.getSession(sessionId);
            if (!session || session.userId !== interaction.user.id) {
                return interaction.reply({ content: 'Session expired. Run the import command again.', ephemeral: true });
            }

            const modal = buildTokenModal(source, sessionId);
            return await interaction.showModal(modal);
        }

        // Fragmented/dissociative warning → proceed with forceAsStates
        if (customId.startsWith('import_states_proceed_')) {
            const sessionId = customId.replace('import_states_proceed_', '');
            const session = utils.getSession(sessionId);
            if (!session || session.userId !== interaction.user.id) {
                return interaction.reply({ content: 'Session expired. Run the import command again.', ephemeral: true });
            }

            session.options.forceAsStates = true;
            utils.setSession(sessionId, session);

            await interaction.deferUpdate();
            return await runImport(interaction, session, sessionId);
        }

        // Confirmation after states select menu → run import with selected states
        if (customId.startsWith('import_states_confirm_')) {
            const sessionId = customId.replace('import_states_confirm_', '');
            const session = utils.getSession(sessionId);
            if (!session || session.userId !== interaction.user.id) {
                return interaction.reply({ content: 'Session expired. Run the import command again.', ephemeral: true });
            }

            await interaction.deferUpdate();
            return await runImport(interaction, session, sessionId);
        }

        // Cancel import
        if (customId.startsWith('import_states_cancel_')) {
            const sessionId = customId.replace('import_states_cancel_', '');
            utils.deleteSession(sessionId);
            return await interaction.update({
                embeds: [new EmbedBuilder()
                    .setColor(IMPORT_COLOR)
                    .setDescription('❌ Import cancelled.')],
                components: []
            });
        }
    },

    // Handle select menu submissions (states selection)
    async handleSelectMenuInteraction(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('import_states_select_')) {
            const sessionId = customId.replace('import_states_select_', '');
            const session = utils.getSession(sessionId);
            if (!session || session.userId !== interaction.user.id) {
                return interaction.reply({ content: 'Session expired. Run the import command again.', ephemeral: true });
            }

            const selected = interaction.values;
            const skipped = selected.includes('_skip_');

            if (!skipped && selected.length > 0) {
                session.options.stateNames = selected.map(s => s.toLowerCase());
                utils.setSession(sessionId, session);
            }

            // Show confirmation embed
            const sourceTerm = getSourceEntityTerm(session.source);
            const totalMembers = session.fetchedMembers?.length || 0;
            const stateCount = skipped ? 0 : selected.length;
            const alterCount = totalMembers - stateCount;

            const confirmEmbed = new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setTitle('Confirm Import')
                .setDescription(
                    `**Source:** ${getSourceLabel(session.source)}\n` +
                    `**${sourceTerm.charAt(0).toUpperCase() + sourceTerm.slice(1)} found:** ${totalMembers}\n\n` +
                    (stateCount > 0
                        ? `Will import **${alterCount}** as alters and **${stateCount}** as states.`
                        : `Will import all **${totalMembers}** as alters.`)
                );

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`import_states_confirm_${sessionId}`)
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`import_states_cancel_${sessionId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            return await interaction.update({ embeds: [confirmEmbed], components: [confirmRow] });
        }
    },

    // Handle modal submissions (token input)
    async handleModalSubmit(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('import_modal_')) {
            const parts = customId.split('_');
            const source = parts[2];
            const sessionId = parts.slice(3).join('_');

            const session = utils.getSession(sessionId);
            if (!session || session.userId !== interaction.user.id) {
                return interaction.reply({ content: 'Session expired. Run the import command again.', ephemeral: true });
            }

            const tokenOrId = interaction.fields.getTextInputValue('token_input');
            if (!tokenOrId || tokenOrId.trim().length === 0) {
                return interaction.reply({ content: 'No token/ID provided. Run the import command again.', ephemeral: true });
            }

            const system = await System.findById(session.systemId);
            const user = await User.findOne({ systemID: session.systemId });
            if (!system) {
                return interaction.reply({ content: 'System not found. Run the import command again.', ephemeral: true });
            }

            await interaction.deferReply();

            try {
                // Fetch members from API
                let fetchedMembers = [];
                if (source === 'pluralkit') {
                    fetchedMembers = await fetchPKMembers(tokenOrId.trim());
                } else if (source === 'simplyplural') {
                    fetchedMembers = await fetchSPMembers(tokenOrId.trim());
                } else if (source === 'octocon') {
                    const systemId = parseOctoconId(tokenOrId.trim());
                    if (!systemId) {
                        return interaction.editReply('Invalid Octocon system ID. Expected 7 characters (e.g. `abcdefg`) or a URL like `octocon.app/u/abcdefg`.');
                    }
                    fetchedMembers = await fetchOctoconAlters(systemId);
                    session.octoconSystemId = systemId;
                }

                session.fetchedMembers = fetchedMembers;
                session.tokenOrId = tokenOrId.trim();
                session.sysType = system.sys_type || {};
                utils.setSession(sessionId, session);

                const isSystem = session.sysType.isSystem === true;
                const isFragmented = session.sysType.isFragmented === true;
                const isDissociative = session.sysType.isDissociative === true;
                const sourceTerm = getSourceEntityTerm(source);
                const memberCount = fetchedMembers.length;

                // Fragmented/dissociative → warning + proceed as states
                if (!isSystem && (isFragmented || isDissociative)) {
                    const typeLabel = isFragmented ? 'Fragmented' : 'Dissociative';
                    const warningEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ Import as States')
                        .setDescription(
                            `Your profile type is **${typeLabel}**, which means you don't have alters — ` +
                            `all **${memberCount}** ${sourceTerm} will be imported as **states**.\n\n` +
                            `**Source:** ${getSourceLabel(source)}\n` +
                            `**${sourceTerm.charAt(0).toUpperCase() + sourceTerm.slice(1)} found:** ${memberCount}`
                        );

                    const warningRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`import_states_proceed_${sessionId}`)
                            .setLabel(`Proceed as States`)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`import_states_cancel_${sessionId}`)
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Danger)
                    );

                    return await interaction.editReply({ embeds: [warningEmbed], components: [warningRow] });
                }

                // isSystem with ≤25 members → show states select menu
                if (isSystem && memberCount <= 25 && memberCount > 0) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`import_states_select_${sessionId}`)
                        .setPlaceholder(`Select ${sourceTerm} to import as states (optional)`)
                        .setMinValues(0)
                        .setMaxValues(memberCount);

                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Skip — all as alters')
                            .setValue('_skip_')
                            .setDescription('Import everything as alters (default)')
                    );

                    for (const member of fetchedMembers) {
                        const name = member.name || member.display_name || 'Unknown';
                        selectMenu.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(name.substring(0, 100))
                                .setValue(name)
                        );
                    }

                    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

                    const infoEmbed = new EmbedBuilder()
                        .setColor(IMPORT_COLOR)
                        .setTitle(`Import from ${getSourceLabel(source)}`)
                        .setDescription(
                            `Found **${memberCount}** ${sourceTerm}.\n\n` +
                            `Select which ones should be imported as **states** instead of alters, ` +
                            `or skip to import all as alters.`
                        );

                    return await interaction.editReply({ embeds: [infoEmbed], components: [selectRow] });
                }

                // >25 members or 0 members → run import directly
                await createBackup(system, source);
                return await runImportDirect(interaction, session, sessionId);

            } catch (error) {
                console.error('Import modal error:', error);
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(utils.ENTITY_COLORS.error)
                        .setDescription(`❌ ${error.message}`)]
                });
            }
        }
    }
};

// ============================================
// IMPORT EXECUTION
// ============================================

async function runImport(interaction, session, sessionId) {
    const system = await System.findById(session.systemId);
    const user = await User.findOne({ systemID: session.systemId });
    if (!system) {
        return interaction.editReply({ embeds: [new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.error)
            .setDescription('❌ System not found. Run the import command again.')] });
    }

    try {
        await createBackup(system, session.source);

        let result;
        if (session.source === 'pluralkit') {
            result = await importPluralKitAPI(system, user, session.tokenOrId, session.options);
        } else if (session.source === 'simplyplural') {
            result = await importSimplyPluralAPI(system, user, session.tokenOrId, session.options);
        } else if (session.source === 'octocon') {
            result = await importOctoconAPI(system, user, session.octoconSystemId, session.options);
        }

        utils.deleteSession(sessionId);

        await interaction.editReply({
            embeds: [buildImportResultEmbed(getSourceLabel(session.source), result, session.options.target)],
            components: []
        });
    } catch (error) {
        console.error('Import execution error:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)],
            components: []
        });
    }
}

async function runImportDirect(interaction, session, sessionId) {
    const system = await System.findById(session.systemId);
    const user = await User.findOne({ systemID: session.systemId });
    if (!system) {
        return interaction.editReply({ embeds: [new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.error)
            .setDescription('❌ System not found. Run the import command again.')] });
    }

    try {
        await createBackup(system, session.source);

        let result;
        if (session.source === 'pluralkit') {
            result = await importPluralKitAPI(system, user, session.tokenOrId, session.options);
        } else if (session.source === 'simplyplural') {
            result = await importSimplyPluralAPI(system, user, session.tokenOrId, session.options);
        } else if (session.source === 'octocon') {
            result = await importOctoconAPI(system, user, session.octoconSystemId, session.options);
        }

        const memberCount = session.fetchedMembers?.length || 0;
        const largeImportNote = memberCount > 25
            ? `\n\n📝 *${memberCount} ${getSourceEntityTerm(session.source)} found — too many for interactive states selection. Use \`-states:Name1,Name2\` flag to reclassify specific ${getSourceEntityTerm(session.source)} as states.*`
            : '';

        utils.deleteSession(sessionId);

        const resultEmbed = buildImportResultEmbed(getSourceLabel(session.source), result, session.options.target);
        if (largeImportNote) {
            resultEmbed.setDescription(resultEmbed.data.description + largeImportNote);
        }

        await interaction.editReply({ embeds: [resultEmbed], components: [] });
    } catch (error) {
        console.error('Import execution error:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error.message}`)],
            components: []
        });
    }
}

// ============================================
// UI HELPERS — Token Button + Modal
// ============================================

function getSourceLabel(source) {
    const labels = {
        pluralkit: 'PluralKit',
        simplyplural: 'Simply Plural',
        octocon: 'Octocon'
    };
    return labels[source] || source;
}

async function showTokenButton(message, source, sessionId) {
    const labels = {
        pluralkit: { title: '🔷 PluralKit Import', desc: 'Click the button below to enter your PluralKit API token.\n\nGet your token: DM PluralKit with `pk;token`' },
        simplyplural: { title: '💜 Simply Plural Import', desc: 'Click the button below to enter your Simply Plural API token.\n\nGet your token: Settings → Developer → Add Token (Read permission)' },
        octocon: { title: '🐙 Octocon Import', desc: 'Click the button below to enter your Octocon system ID.\n\nFind it at: `octocon.app/u/yourid`\nID is 7 characters (e.g. `abcdefg`)\n\n⚠️ Private/trusted alters may not appear via API.' }
    };

    const info = labels[source];

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`import_token_${source}_${sessionId}`)
            .setLabel('Enter Token')
            .setStyle(ButtonStyle.Primary)
    );

    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(IMPORT_COLOR)
            .setTitle(info.title)
            .setDescription(info.desc)],
        components: [row]
    });
}

function buildTokenModal(source, sessionId) {
    const placeholders = {
        pluralkit: 'pk;token or your 5-6 char system token',
        simplyplural: 'Your SP API token',
        octocon: 'Your 7-char system ID or octocon.app/u/yourid URL'
    };

    const labels = {
        pluralkit: 'PluralKit Token',
        simplyplural: 'Simply Plural Token',
        octocon: 'Octocon System ID'
    };

    const modal = new ModalBuilder()
        .setCustomId(`import_modal_${source}_${sessionId}`)
        .setTitle(`Import from ${getSourceLabel(source)}`);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('token_input')
                .setLabel(labels[source])
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(placeholders[source])
                .setRequired(true)
                .setMaxLength(200)
        )
    );

    return modal;
}

// ============================================
// HANDLERS — File-based imports (no modal needed)
// ============================================

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

async function handleOctoconFile(message, system, user, options) {
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

        await createBackup(system, 'octocon');
        await statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(IMPORT_COLOR)
                .setDescription(`🔄 Processing **${fileData.alters?.length || 0}** alters...`)]
        });

        const result = await importOctoconFile(system, user, fileData, options);

        await statusMsg.edit({
            embeds: [buildImportResultEmbed('Octocon', result, options.target)]
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

        let source = 'Unknown';
        if (fileData.tuppers) source = 'Tupperbox';
        else if (fileData.user && fileData.alters && fileData.tags) source = 'Octocon';
        else if (fileData.members || fileData.id) source = 'PluralKit';

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
                    '`sys!import pluralkit` → enter token in modal',
                    'Get token: DM PluralKit with `pk;token`',
                    '',
                    '**Via file:**',
                    '`sys!import pluralkit` + attach file',
                    'Export with: `pk;export`'
                ].join('\n'),
                inline: false
            },
            {
                name: '📦 Tupperbox',
                value: [
                    '`sys!import tupperbox` + attach file',
                    'Export with: `tul!export`',
                    '',
                    '*Tupperbox doesn\'t have an API*'
                ].join('\n'),
                inline: false
            },
            {
                name: '💜 Simply Plural',
                value: [
                    '`sys!import simplyplural` → enter token in modal',
                    'Get token: Settings → Developer → Add Token',
                    '*(Check "Read" permission)*'
                ].join('\n'),
                inline: false
            },
            {
                name: '🐙 Octocon',
                value: [
                    '**Via API (recommended):**',
                    '`sys!import octocon` → enter system ID in modal',
                    'Find ID at: `octocon.app/u/yourid`',
                    '',
                    '**Via file:**',
                    '`sys!import octocon` + attach file',
                    '',
                    '⚠️ Private/trusted alters may not appear via API.'
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
                    'sys!import simplyplural',
                    '',
                    '# 2. Add PluralKit data for Discord',
                    'sys!import pluralkit -target:discord',
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
                    '`sys!import pk -states:Tired,Anxious`',
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
