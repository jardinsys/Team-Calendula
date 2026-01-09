// (/state) - Systemiser State Management Command

// (/state menu)
// (/state showlist ) (click button to show full in ephemeral)
// (/state showlist user:[@user] userID:[string])

// (/state show user:[@user] userID:[string] state_name:[string]) (click button to show all info in ephemeral)
// (/state show state_name:[string])

// (/state new state_name:[string])
// (/state delete state_name:[string])
// (/state remission state_name:[string])

// (/state state_name:[string] edit (have the select menu of what to edit (card info, personal info, proxy info, image info, caution info ) and have a buttons to (enter mask mode, open state settings, edit groups, edit states))
// (/state state_name:[string] settings

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const State = require('../../../schemas/state');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const Group = require('../../../schemas/group');

// Import shared utilities
const utils = require('../../functions/bot_utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('state')
        .setDescription('Manage your states')

        // VIEW subcommand
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View state information')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to view')
                .setRequired(true)
                .addChoices(
                    { name: 'List - Show all states', value: 'list' },
                    { name: 'Show - View specific state details', value: 'show' }
                ))
            .addStringOption(opt => opt
                .setName('state_name')
                .setDescription('State name (required for "show")')
                .setRequired(false))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('View another user\'s states')
                .setRequired(false))
            .addBooleanOption(opt => opt
                .setName('show_all')
                .setDescription('Show hidden states (list only)')
                .setRequired(false)))

        // MANAGE subcommand
        .addSubcommand(sub => sub
            .setName('manage')
            .setDescription('Create, edit, and delete states')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to do')
                .setRequired(true)
                .addChoices(
                    { name: 'New - Create new state', value: 'new' },
                    { name: 'Edit - Modify existing state', value: 'edit' },
                    { name: 'Remission - Mark state as in remission', value: 'remission' },
                    { name: 'Delete - Remove state permanently', value: 'delete' }
                ))
            .addStringOption(opt => opt
                .setName('state_name')
                .setDescription('State name (required for edit/remission/delete)')
                .setRequired(false)))

        // SETTINGS subcommand
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Configure state settings')
            .addStringOption(opt => opt
                .setName('state_name')
                .setDescription('State name')
                .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) {
            return await utils.handleNewUserFlow(interaction, 'state');
        }

        if (!system && subcommand !== 'view') {
            return await interaction.reply({
                content: '❌ You need to set up a system first. Use `/system` to get started.',
                ephemeral: true
            });
        }

        // Route based on subcommand and action
        if (subcommand === 'view') {
            const action = interaction.options.getString('action');
            if (action === 'list') {
                return await handleShowList(interaction, user, system);
            } else if (action === 'show') {
                return await handleShow(interaction, user, system);
            }
        } else if (subcommand === 'manage') {
            const action = interaction.options.getString('action');
            if (action === 'new') {
                return await handleNew(interaction, user, system);
            } else if (action === 'edit') {
                return await handleEdit(interaction, user, system);
            } else if (action === 'remission') {
                return await handleRemission(interaction, user, system);
            } else if (action === 'delete') {
                return await handleDelete(interaction, user, system);
            }
        } else if (subcommand === 'settings') {
            return await handleSettings(interaction, user, system);
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ============================================
// EMBED BUILDERS (State-specific)
// ============================================

/**
 * Build the state list embed
 */
function buildStateListEmbed(states, page, system, showFullList) {
    const pageStates = utils.getPageItems(states, page);
    const totalPages = utils.getTotalPages(states.length);

    const embed = new EmbedBuilder()
        .setTitle(`${utils.getDisplayName(system)}'s States`)
        .setDescription(showFullList ? '📋 Showing full list (including hidden)' : '📋 State List')
        .setFooter({
            text: `Page ${page + 1}/${totalPages} • ${states.length} state${states.length !== 1 ? 's' : ''}`
        });

    // Use system color if available
    const embedColor = utils.getSystemEmbedColor(system);
    if (embedColor) embed.setColor(embedColor);

    if (pageStates.length === 0) {
        embed.addFields({
            name: 'No states',
            value: 'No states to display on this page.'
        });
    } else {
        const stateList = pageStates.map(state => {
            const name = state.name?.indexable || 'Unknown';
            const proxies = utils.formatProxies(state.proxy);
            return `**${name}** - ${proxies}`;
        }).join('\n');

        embed.addFields({ name: 'States', value: stateList });
    }

    return embed;
}

/**
 * Build the state card embed
 */
async function buildStateCard(state, system, privacyBucket, closedCharAllowed = true) {
    const embed = new EmbedBuilder();

    // Color priority: state.color > system.color > none
    const color = utils.getEntityEmbedColor(state, system);
    const description = utils.getDiscordOrDefault(state, 'description');
    const displayName = closedCharAllowed
        ? (state.name?.display || state.name?.indexable)
        : (state.name?.closedNameDisplay || state.name?.display || state.name?.indexable);

    // Header/Author
    const proxyAvatar = state.discord?.image?.proxyAvatar?.url || state.avatar?.url;
    const systemDisplayName = utils.getDisplayName(system, closedCharAllowed);

    embed.setAuthor({
        name: `${state.name?.indexable || 'Unknown'} (from ${systemDisplayName})`,
        iconURL: proxyAvatar || undefined
    });

    embed.setTitle(displayName || 'Unknown State');
    if (color) embed.setColor(color);

    if (description) {
        embed.setDescription(description);
    }

    // Get groups for this state
    const groups = await Group.find({ _id: { $in: state.groupIDs || [] } });

    // Organize groups by type
    const groupsByType = {};
    for (const group of groups) {
        const typeName = group.type?.name || 'Other';
        if (!groupsByType[typeName]) groupsByType[typeName] = [];
        groupsByType[typeName].push(utils.getDisplayName(group, closedCharAllowed));
    }

    // Get connected alters
    const connectedAlters = await Alter.find({ _id: { $in: state.alters || [] } });
    const alterNames = connectedAlters.map(a => utils.getDisplayName(a, closedCharAllowed));

    // Identification Info field
    let identificationInfo = '';

    for (const [type, groupNames] of Object.entries(groupsByType)) {
        identificationInfo += `**${type}:** ${groupNames.join(', ')}\n`;
    }

    if (state.signoff) {
        identificationInfo += `**Sign-off:** ${state.signoff}\n`;
    }

    if (state.proxy?.length > 0) {
        identificationInfo += `**Proxies:** ${utils.formatProxies(state.proxy)}\n`;
    }

    identificationInfo += `**Display Name:** ${displayName}\n`;

    if (identificationInfo) {
        embed.addFields({
            name: '🏷️ Identification',
            value: identificationInfo.trim() || 'None',
            inline: false
        });
    }

    // Connected Alters field
    if (alterNames.length > 0) {
        embed.addFields({
            name: '🔗 Connected Alters',
            value: alterNames.join(', '),
            inline: false
        });
    }

    // Personal Info field (aliases only for states)
    if (state.name?.aliases?.length > 0) {
        embed.addFields({
            name: '👤 Personal Info',
            value: `**Aliases:** ${state.name.aliases.join(', ')}`,
            inline: false
        });
    }

    // Caution field
    if (state.caution && (state.caution.c_type || state.caution.detail || state.caution.triggers?.length > 0)) {
        let cautionInfo = '';

        if (state.caution.c_type) {
            cautionInfo += `**Type:** ${state.caution.c_type}\n`;
        }
        if (state.caution.detail) {
            cautionInfo += `**Details:** ${state.caution.detail}\n`;
        }
        if (state.caution.triggers?.length > 0) {
            const triggerNames = state.caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length > 0) {
                cautionInfo += `**Triggers:** ${triggerNames.join(', ')}\n`;
            }
        }

        if (cautionInfo) {
            embed.addFields({
                name: '⚠️ Caution',
                value: cautionInfo.trim(),
                inline: false
            });
        }
    }

    // Thumbnail
    const avatar = state.discord?.image?.avatar?.url || state.avatar?.url;
    if (avatar) {
        embed.setThumbnail(avatar);
    }

    return embed;
}

/**
 * Build the edit interface for a state
 */
function buildEditInterface(state, session, system = null) {
    const embed = new EmbedBuilder()
        .setTitle(`Editing: ${utils.getDisplayName(state)}`)
        .setDescription(session.mode
            ? `Currently in **${session.mode.toUpperCase()} MODE**\n\nSelect what you would like to edit.`
            : 'Select what you would like to edit from the dropdown menu below.'
        );

    // Color priority: state.color > system.color > none
    const color = utils.getEntityEmbedColor(state, system);
    if (color) embed.setColor(color);

    // Edit options dropdown
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`state_edit_select_${session.id}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Card Info')
                .setDescription('Edit name, description, color')
                .setValue('card_info')
                .setEmoji('🎴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Connected Alters')
                .setDescription('Edit which alters are connected to this state')
                .setValue('alters_info')
                .setEmoji('🔗'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Aliases')
                .setDescription('Edit state aliases')
                .setValue('aliases_info')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Proxy Info')
                .setDescription('Edit proxy tags and sign-off')
                .setValue('proxy_info')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Image Info')
                .setDescription('Edit avatar and banner URLs')
                .setValue('image_info')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Caution Info')
                .setDescription('Edit caution type, details, and triggers')
                .setValue('caution_info')
                .setEmoji('⚠️')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Mode toggle buttons
    const modeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`state_edit_mode_mask_${session.id}`)
            .setLabel(session.mode === 'mask' ? 'Exit Mask Mode' : 'Enter Mask Mode')
            .setStyle(session.mode === 'mask' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`state_edit_mode_server_${session.id}`)
            .setLabel(session.mode === 'server' ? 'Exit Server Mode' : 'Enter Server Mode')
            .setStyle(session.mode === 'server' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🏠')
    );

    // Action buttons
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`state_edit_settings_${session.id}`)
            .setLabel('State Settings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚙️'),
        new ButtonBuilder()
            .setCustomId(`state_edit_groups_${session.id}`)
            .setLabel('Edit Groups')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥'),
        new ButtonBuilder()
            .setCustomId(`state_edit_done_${session.id}`)
            .setLabel('Done')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    );

    return { embed, components: [selectRow, modeRow, actionRow] };
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Handle /state menu
 */
async function handleMenu(interaction, user, system) {
    const embed = new EmbedBuilder()
        .setTitle('🔄 State Management')
        .setDescription('Select a button to start managing your states.')
        .setFooter({ text: 'Use the buttons below to navigate' });

    // Use system color if available
    const color = utils.getSystemEmbedColor(system);
    if (color) embed.setColor(color);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('state_menu_showlist')
            .setLabel('Show List')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('state_menu_select')
            .setLabel('Select State')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /state showlist
 */
async function handleShowList(interaction, currentUser, currentSystem) {
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    // If viewing another user's list
    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;

        const User = require('../../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser || !otherUser.systemID) {
            return await interaction.reply({
                content: '❌ This user does not have a state list to show. They may not have a system set up in this application...',
                ephemeral: true
            });
        }

        targetSystem = await System.findById(otherUser.systemID);

        if (!targetSystem) {
            return await interaction.reply({
                content: '❌ This user does not have a state list to show. They may not have a system set up in this application...',
                ephemeral: true
            });
        }

        // Check if blocked
        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) {
            return await interaction.reply({
                content: '❌ This user does not have a state list to show. They may not have a system set up in this application...',
                ephemeral: true
            });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) {
        return await interaction.reply({
            content: '❌ No system found. Use `/system` to set up your system first.',
            ephemeral: true
        });
    }

    // Get all states for this system
    const states = await State.find({ _id: { $in: targetSystem.states?.IDs || [] } });

    if (states.length === 0) {
        return await interaction.reply({
            content: '📭 No states found in this system.',
            ephemeral: true
        });
    }

    // Filter states based on visibility
    const visibleStates = states.filter(state =>
        utils.shouldShowEntity(state, privacyBucket, isOwner, false)
    );

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'showlist',
        states: visibleStates,
        allStates: states,
        page: 0,
        showFullList: false,
        isOwner,
        systemId: targetSystem._id
    });

    const embed = buildStateListEmbed(visibleStates, 0, targetSystem, false);
    const buttons = utils.buildListButtons(visibleStates.length, 0, isOwner, false, sessionId, 'state');

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

/**
 * Handle /state show
 */
async function handleShow(interaction, currentUser, currentSystem) {
    const stateName = interaction.options.getString('state_name');
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    // If viewing another user's state
    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;

        const User = require('../../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser || !otherUser.systemID) {
            return await interaction.reply({
                content: '❌ State cannot be found.',
                ephemeral: true
            });
        }

        targetSystem = await System.findById(otherUser.systemID);

        if (!targetSystem) {
            return await interaction.reply({
                content: '❌ State cannot be found.',
                ephemeral: true
            });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) {
        return await interaction.reply({
            content: '❌ No system found.',
            ephemeral: true
        });
    }

    // Find the state
    const state = await utils.findStateByName(stateName, targetSystem);

    if (!state) {
        return await interaction.reply({
            content: '❌ State cannot be found.',
            ephemeral: true
        });
    }

    // Check visibility
    if (!isOwner && !utils.shouldShowEntity(state, privacyBucket, isOwner)) {
        return await interaction.reply({
            content: '❌ State cannot be found.',
            ephemeral: true
        });
    }

    // Check closed character settings
    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    // Build the card
    const embed = await buildStateCard(state, targetSystem, privacyBucket, closedCharAllowed);

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'show',
        stateId: state._id,
        systemId: targetSystem._id,
        isOwner
    });

    // Only show "Show All Info" button if owner
    const buttons = isOwner ? [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`state_show_full_${sessionId}`)
                .setLabel('Show All Info')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📄')
        )
    ] : [];

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

/**
 * Handle /state new
 */
async function handleNew(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');

    // Validate name format
    if (!utils.isValidIndexableName(stateName)) {
        return await interaction.reply({
            content: '❌ Indexable names can only include standard letters, numbers, hyphens, and underscores.',
            ephemeral: true
        });
    }

    // Check if state already exists
    const existingState = await utils.findStateByName(stateName, system);
    if (existingState) {
        return await interaction.reply({
            content: '❌ A state with this name already exists in your system.',
            ephemeral: true
        });
    }

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'new',
        stateName: stateName.toLowerCase(),
        systemId: system._id,
        userId: user._id
    });

    // Show sync confirmation
    const { embed, buttons } = utils.buildSyncConfirmation('state', stateName, sessionId, 'new');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /state edit
 */
async function handleEdit(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);

    if (!state) {
        return await interaction.reply({
            content: '❌ State not found in your system.',
            ephemeral: true
        });
    }

    // Verify ownership
    if (state.systemID !== system._id.toString()) {
        return await interaction.reply({
            content: '❌ This state does not belong to your system.',
            ephemeral: true
        });
    }

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'edit',
        stateId: state._id,
        systemId: system._id,
        mode: null,
        syncWithDiscord: state.syncWithApps?.discord || false
    });

    // Show sync confirmation
    const { embed, buttons } = utils.buildSyncConfirmation('state', utils.getDisplayName(state), sessionId, 'edit');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /state remission
 */
async function handleRemission(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);

    if (!state) {
        return await interaction.reply({
            content: '❌ State not found in your system.',
            ephemeral: true
        });
    }

    // Update condition
    state.condition = 'remission';
    await state.save();

    await interaction.reply({
        content: `✅ **${utils.getDisplayName(state)}** has been marked as in remission.`,
        ephemeral: true
    });
}

/**
 * Handle /state delete
 */
async function handleDelete(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);

    if (!state) {
        return await interaction.reply({
            content: '❌ State not found in your system.',
            ephemeral: true
        });
    }

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'delete',
        stateId: state._id,
        systemId: system._id
    });

    // Build confirmation embed
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Delete State Confirmation')
        .setDescription(
            `Are you sure you want to delete **${utils.getDisplayName(state)}**?\n\n` +
            `If this state is simply inactive, you can mark it as in remission or another condition instead.`
        )
        .setFooter({ text: 'This action cannot be undone!' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`state_delete_remission_${sessionId}`)
            .setLabel('Mark as Remission')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`state_delete_condition_${sessionId}`)
            .setLabel('Change Condition')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`state_delete_confirm_${sessionId}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`state_delete_cancel_${sessionId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /state settings
 */
async function handleSettings(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);

    if (!state) {
        return await interaction.reply({
            content: '❌ State not found in your system.',
            ephemeral: true
        });
    }

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'settings',
        stateId: state._id,
        systemId: system._id
    });

    // Build settings embed
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Settings: ${utils.getDisplayName(state)}`)
        .setDescription('Configure settings for this state.')
        .addFields(
            {
                name: 'Closed Name Display',
                value: state.name?.closedNameDisplay || '*Not set*',
                inline: true
            },
            {
                name: 'Default Status',
                value: state.setting?.default_status || '*Not set*',
                inline: true
            },
            {
                name: 'Current Condition',
                value: state.condition || '*None*',
                inline: true
            }
        );

    // Color priority: state.color > system.color > none
    const settingsColor = utils.getEntityEmbedColor(state, system);
    if (settingsColor) embed.setColor(settingsColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`state_settings_closedname_${sessionId}`)
            .setLabel('Edit Closed Name')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`state_settings_status_${sessionId}`)
            .setLabel('Edit Default Status')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`state_settings_privacy_${sessionId}`)
            .setLabel('Privacy Settings')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`state_settings_mask_${sessionId}`)
            .setLabel('Mask Settings')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

// ============================================
// BUTTON INTERACTION HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle new user flow buttons
    if (customId.startsWith('new_user_')) {
        return await utils.handleNewUserButton(interaction, 'state');
    }

    // Handle menu buttons
    if (customId === 'state_menu_showlist') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        const mockInteraction = {
            ...interaction,
            options: { getUser: () => null, getString: () => null }
        };
        return await handleShowList(mockInteraction, user, system);
    }

    // Extract session ID from custom ID
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    // Handle list navigation
    if (customId.startsWith('state_list_prev_')) {
        session.page = Math.max(0, session.page - 1);
    }

    if (customId.startsWith('state_list_next_')) {
        const states = session.showFullList ? session.allStates : session.states;
        session.page = Math.min(utils.getTotalPages(states.length) - 1, session.page + 1);
    }

    if (customId.startsWith('state_list_toggle_')) {
        session.showFullList = !session.showFullList;
        session.page = 0;
    }

    if (customId.startsWith('state_list_')) {
        const states = session.showFullList ? session.allStates : session.states;
        const system = await System.findById(session.systemId);
        const embed = buildStateListEmbed(states, session.page, system, session.showFullList);
        const buttons = utils.buildListButtons(states.length, session.page, session.isOwner, session.showFullList, sessionId, 'state');
        return await interaction.update({ embeds: [embed], components: buttons });
    }

    // Handle show full info
    if (customId.startsWith('state_show_full_')) {
        const state = await State.findById(session.stateId);
        const system = await System.findById(session.systemId);
        const embed = await buildStateCard(state, system, null, true);

        // Add metadata
        let metadataInfo = '';
        if (state.metadata?.addedAt) {
            metadataInfo += `**Added:** ${utils.formatDate(state.metadata.addedAt)}\n`;
        }
        if (state.genesisDate) {
            metadataInfo += `**Genesis Date:** ${utils.formatDate(state.genesisDate)}\n`;
        }
        if (state.addedAt) {
            metadataInfo += `**Added At:** ${utils.formatDate(state.addedAt)}\n`;
        }
        if (state.discord?.metadata?.messageCount) {
            metadataInfo += `**Discord Messages:** ${state.discord.metadata.messageCount}\n`;
        }
        if (state.discord?.metadata?.lastMessageTime) {
            metadataInfo += `**Last Message:** ${utils.formatDate(state.discord.metadata.lastMessageTime)}\n`;
        }

        if (metadataInfo) {
            embed.addFields({ name: '📊 Metadata', value: metadataInfo.trim(), inline: false });
        }

        return await interaction.update({ embeds: [embed], components: [] });
    }

    // Handle sync buttons for new/edit
    if (customId.startsWith('state_new_sync_') || customId.startsWith('state_edit_sync_')) {
        session.syncWithDiscord = customId.includes('_yes_');
        session.id = sessionId;

        if (customId.startsWith('state_new_sync_')) {
            // Create the new state
            const newState = new State({
                systemID: session.systemId,
                genesisDate: new Date(),
                addedAt: new Date(),
                syncWithApps: { discord: session.syncWithDiscord },
                name: {
                    indexable: session.stateName,
                    display: session.stateName
                },
                alters: [],
                groupIDs: [],
                metadata: { addedAt: new Date() }
            });

            await newState.save();

            // Add to system
            await System.findByIdAndUpdate(session.systemId, {
                $push: { 'states.IDs': newState._id.toString() }
            });

            session.stateId = newState._id;
            session.type = 'edit';
        } else {
            // Update existing state's sync setting
            const state = await State.findById(session.stateId);
            state.syncWithApps = { discord: session.syncWithDiscord };
            await state.save();
        }

        // Show edit interface
        const state = await State.findById(session.stateId);
        const { embed, components } = buildEditInterface(state, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle mode toggles
    if (customId.startsWith('state_edit_mode_mask_')) {
        session.mode = session.mode === 'mask' ? null : 'mask';
    }

    if (customId.startsWith('state_edit_mode_server_')) {
        session.mode = session.mode === 'server' ? null : 'server';
    }

    if (customId.startsWith('state_edit_mode_')) {
        const state = await State.findById(session.stateId);
        const { embed, components } = buildEditInterface(state, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle edit done
    if (customId.startsWith('state_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({
            content: '✅ Editing complete!',
            embeds: [],
            components: []
        });
    }

    // Handle delete buttons
    if (customId.startsWith('state_delete_remission_')) {
        const state = await State.findById(session.stateId);
        state.condition = 'remission';
        await state.save();
        utils.deleteSession(sessionId);
        return await interaction.update({
            content: `✅ **${utils.getDisplayName(state)}** has been marked as in remission.`,
            embeds: [],
            components: []
        });
    }

    if (customId.startsWith('state_delete_condition_')) {
        const modal = new ModalBuilder()
            .setCustomId(`state_condition_modal_${sessionId}`)
            .setTitle('Change Condition');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('condition_name')
                    .setLabel('Condition Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., remission, inactive, dormant')
                    .setRequired(true)
                    .setMaxLength(50)
            )
        );

        return await interaction.showModal(modal);
    }

    if (customId.startsWith('state_delete_confirm_')) {
        const system = await System.findById(session.systemId);

        // Remove from system
        system.states.IDs = system.states.IDs.filter(id => id !== session.stateId.toString());
        await system.save();

        // Delete the state
        await State.findByIdAndDelete(session.stateId);

        utils.deleteSession(sessionId);
        return await interaction.update({
            content: '✅ State has been deleted.',
            embeds: [],
            components: []
        });
    }

    if (customId.startsWith('state_delete_cancel_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({
            content: '❌ Deletion cancelled.',
            embeds: [],
            components: []
        });
    }

    // Handle settings buttons
    if (customId.startsWith('state_settings_closedname_')) {
        const state = await State.findById(session.stateId);

        const modal = new ModalBuilder()
            .setCustomId(`state_settings_closedname_modal_${sessionId}`)
            .setTitle('Edit Closed Name Display');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('closed_name')
                    .setLabel('Closed Name Display')
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.name?.closedNameDisplay || '')
                    .setRequired(false)
                    .setMaxLength(100)
            )
        );

        return await interaction.showModal(modal);
    }

    if (customId.startsWith('state_settings_status_')) {
        const state = await State.findById(session.stateId);

        const modal = new ModalBuilder()
            .setCustomId(`state_settings_status_modal_${sessionId}`)
            .setTitle('Edit Default Status');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('default_status')
                    .setLabel('Default Status')
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.setting?.default_status || '')
                    .setRequired(false)
                    .setMaxLength(100)
            )
        );

        return await interaction.showModal(modal);
    }
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    const state = await State.findById(session.stateId);
    const value = interaction.values[0];

    // Build appropriate modal based on selection
    let modal;

    switch (value) {
        case 'card_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_card_modal_${sessionId}`)
                .setTitle('Edit Card Info');

            const cardTarget = utils.getEditTarget(state, session);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('display_name')
                        .setLabel('Display Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(cardTarget?.name?.display || state.name?.display || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Description')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(cardTarget?.description || state.description || '')
                        .setRequired(false)
                        .setMaxLength(2000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('color')
                        .setLabel('Color (hex code)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(cardTarget?.color || state.color || '')
                        .setRequired(false)
                        .setMaxLength(7)
                )
            );
            break;

        case 'alters_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_alters_modal_${sessionId}`)
                .setTitle('Edit Connected Alters');

            // Get current connected alter names
            const connectedAlters = await Alter.find({ _id: { $in: state.alters || [] } });
            const alterNames = connectedAlters.map(a => a.name?.indexable).filter(Boolean);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('alter_names')
                        .setLabel('Connected Alters (comma-separated names)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(alterNames.join(', '))
                        .setPlaceholder('Enter alter indexable names, separated by commas')
                        .setRequired(false)
                        .setMaxLength(1000)
                )
            );
            break;

        case 'aliases_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_aliases_modal_${sessionId}`)
                .setTitle('Edit Aliases');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('aliases')
                        .setLabel('Aliases (comma-separated)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.name?.aliases?.join(', ') || '')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
            break;

        case 'proxy_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_proxy_modal_${sessionId}`)
                .setTitle('Edit Proxy Info');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('proxies')
                        .setLabel('Proxies (one per line, use "text" as placeholder)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.proxy?.join('\n') || '')
                        .setPlaceholder('s:text\ntext -s\n-state text')
                        .setRequired(false)
                        .setMaxLength(500)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('signoff')
                        .setLabel('Sign-offs (one per line, emojis recommended)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.signoff || '')
                        .setPlaceholder('✨\n💫')
                        .setRequired(false)
                        .setMaxLength(200)
                )
            );
            break;

        case 'image_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_image_modal_${sessionId}`)
                .setTitle('Edit Image Info');

            const imageTarget = utils.getEditTarget(state, session);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('avatar_url')
                        .setLabel('Avatar URL')
                        .setStyle(TextInputStyle.Short)
                        .setValue(imageTarget?.avatar?.url || imageTarget?.image?.avatar?.url || state.avatar?.url || '')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('banner_url')
                        .setLabel('Banner URL')
                        .setStyle(TextInputStyle.Short)
                        .setValue(imageTarget?.image?.banner?.url || state.discord?.image?.banner?.url || '')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('proxy_avatar_url')
                        .setLabel('Proxy Avatar URL')
                        .setStyle(TextInputStyle.Short)
                        .setValue(imageTarget?.image?.proxyAvatar?.url || state.discord?.image?.proxyAvatar?.url || '')
                        .setRequired(false)
                )
            );
            break;

        case 'caution_info':
            modal = new ModalBuilder()
                .setCustomId(`state_edit_caution_modal_${sessionId}`)
                .setTitle('Edit Caution Info');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('caution_type')
                        .setLabel('Caution Type')
                        .setStyle(TextInputStyle.Short)
                        .setValue(state.caution?.c_type || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('caution_detail')
                        .setLabel('Caution Details')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.caution?.detail || '')
                        .setRequired(false)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('trigger_names')
                        .setLabel('Trigger Names (comma-separated)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(state.caution?.triggers?.map(t => t.name).join(', ') || '')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
            break;

        default:
            return await interaction.reply({
                content: '❌ Unknown option selected.',
                ephemeral: true
            });
    }

    await interaction.showModal(modal);
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    const state = await State.findById(session.stateId);

    // Handle condition change modal
    if (interaction.customId.startsWith('state_condition_modal_')) {
        const conditionName = interaction.fields.getTextInputValue('condition_name');
        state.condition = conditionName;
        await state.save();

        // Ensure condition exists in system
        const system = await System.findById(session.systemId);
        await utils.ensureConditionExists(system, 'states', conditionName);

        utils.deleteSession(sessionId);
        return await interaction.update({
            content: `✅ **${utils.getDisplayName(state)}** condition changed to "${conditionName}".`,
            embeds: [],
            components: []
        });
    }

    // Handle card info modal
    if (interaction.customId.startsWith('state_edit_card_modal_')) {
        const displayName = interaction.fields.getTextInputValue('display_name');
        const description = interaction.fields.getTextInputValue('description');
        const color = interaction.fields.getTextInputValue('color');

        utils.updateEntityProperty(state, session, 'name.display', displayName);
        utils.updateEntityProperty(state, session, 'description', description);
        utils.updateEntityProperty(state, session, 'color', color);

        await state.save();
    }

    // Handle connected alters modal
    if (interaction.customId.startsWith('state_edit_alters_modal_')) {
        const alterNamesInput = interaction.fields.getTextInputValue('alter_names');
        const alterNames = utils.parseCommaSeparated(alterNamesInput);

        // Get system to find alters
        const system = await System.findById(session.systemId);
        const allAlters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });

        // Find matching alters by indexable name
        const matchingAlterIds = [];
        for (const name of alterNames) {
            const alter = allAlters.find(a =>
                a.name?.indexable?.toLowerCase() === name.toLowerCase()
            );
            if (alter) {
                matchingAlterIds.push(alter._id.toString());
            }
        }

        state.alters = matchingAlterIds;
        await state.save();
    }

    // Handle aliases modal
    if (interaction.customId.startsWith('state_edit_aliases_modal_')) {
        const aliasesInput = interaction.fields.getTextInputValue('aliases');

        if (!state.name) state.name = {};
        state.name.aliases = utils.parseCommaSeparated(aliasesInput);

        await state.save();
    }

    // Handle proxy info modal
    if (interaction.customId.startsWith('state_edit_proxy_modal_')) {
        const proxiesInput = interaction.fields.getTextInputValue('proxies');
        const signoff = interaction.fields.getTextInputValue('signoff');

        // Parse proxies
        const newProxies = utils.parseNewlineSeparated(proxiesInput);

        // Validate proxies for duplicates
        if (newProxies.length > 0) {
            const system = await System.findById(session.systemId);
            const { valid, duplicates } = await utils.validateProxies(
                newProxies,
                system,
                state._id.toString(),
                'state'
            );

            if (duplicates.length > 0) {
                const dupList = duplicates.map(d => `\`${d.proxy}\` (used by ${d.owner})`).join('\n');

                // Still save valid proxies
                state.proxy = valid;
                if (signoff !== undefined) state.signoff = signoff || undefined;
                await state.save();

                // Show warning about duplicates
                session.id = sessionId;
                const { embed, components } = buildEditInterface(state, session);
                return await interaction.update({
                    content: `⚠️ Some proxies were already in use and were skipped:\n${dupList}\n\nValid proxies were saved.`,
                    embeds: [embed],
                    components
                });
            }

            state.proxy = valid;
        } else {
            state.proxy = [];
        }

        if (signoff !== undefined) state.signoff = signoff || undefined;
        await state.save();
    }

    // Handle image info modal
    if (interaction.customId.startsWith('state_edit_image_modal_')) {
        const avatarUrl = interaction.fields.getTextInputValue('avatar_url');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url');
        const proxyAvatarUrl = interaction.fields.getTextInputValue('proxy_avatar_url');

        if (session.mode === 'mask') {
            if (!state.mask) state.mask = {};
            if (avatarUrl) state.mask.avatar = { url: avatarUrl };
            if (!state.mask.discord) state.mask.discord = { image: {} };
            if (!state.mask.discord.image) state.mask.discord.image = {};
            if (bannerUrl) state.mask.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) state.mask.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else if (!session.syncWithDiscord) {
            if (!state.discord) state.discord = { image: {} };
            if (!state.discord.image) state.discord.image = {};
            if (avatarUrl) state.discord.image.avatar = { url: avatarUrl };
            if (bannerUrl) state.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) state.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else {
            if (avatarUrl) state.avatar = { url: avatarUrl };
            if (!state.discord) state.discord = { image: {} };
            if (!state.discord.image) state.discord.image = {};
            if (bannerUrl) state.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) state.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        }

        await state.save();
    }

    // Handle caution info modal
    if (interaction.customId.startsWith('state_edit_caution_modal_')) {
        if (!state.caution) state.caution = {};

        const cautionType = interaction.fields.getTextInputValue('caution_type');
        const cautionDetail = interaction.fields.getTextInputValue('caution_detail');
        const triggerNames = interaction.fields.getTextInputValue('trigger_names');

        state.caution.c_type = cautionType || undefined;
        state.caution.detail = cautionDetail || undefined;

        if (triggerNames) {
            state.caution.triggers = utils.parseCommaSeparated(triggerNames).map(name => ({ name }));
        } else {
            state.caution.triggers = [];
        }

        await state.save();
    }

    // Handle settings modals
    if (interaction.customId.startsWith('state_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');

        if (!state.name) state.name = {};
        state.name.closedNameDisplay = closedName || null;

        await state.save();

        return await interaction.update({
            content: `✅ Closed name display updated to: ${closedName || '*Not set*'}`,
            embeds: [],
            components: []
        });
    }

    if (interaction.customId.startsWith('state_settings_status_modal_')) {
        const defaultStatus = interaction.fields.getTextInputValue('default_status');

        if (!state.setting) state.setting = {};
        state.setting.default_status = defaultStatus || undefined;

        await state.save();

        return await interaction.update({
            content: `✅ Default status updated to: ${defaultStatus || '*Not set*'}`,
            embeds: [],
            components: []
        });
    }

    // Return to edit interface for edit modals
    session.id = sessionId;
    const { embed, components } = buildEditInterface(state, session);
    await interaction.update({ embeds: [embed], components });
}