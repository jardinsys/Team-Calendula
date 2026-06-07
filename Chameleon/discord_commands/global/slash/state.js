// (/state) - Systemiser State Management Command

// (/state menu)
// (/state showlist ) (click button to show full in ephemeral)
// (/state showlist user:[@user] userID:[string])

// (/state show user:[@user] userID:[string] state_name:[string]) (click button to show all info in ephemeral)
// (/state show state_name:[string])

//(OLD)
// (/state new state_name:[string])
// (/state delete state_name:[string])
// (/state remission state_name:[string])

// (/state state_name:[string] edit (have the select menu of what to edit (card info, personal info, proxy info, image info, caution info ) and have a buttons to (enter mask mode, open state settings, edit groups, edit states))
// (/state state_name:[string] settings

// (NEW)
// (/state view [list/show])
// (/state manage [new/edit/settings] state_name:[string]) (delete will be in settings)
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
const proxyMessageHandler = require('../proxy-message');

const { getSystemTerm } = utils;

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
                    { name: 'List - View all states', value: 'list' },
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
            /*.addBooleanOption(opt => opt
                .setName('show_all')
                .setDescription('Show hidden states (list only)')
                .setRequired(false))*/
            )

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
                    { name: 'Settings - Edit settings for existing state', value: 'settings'},
                    { name: 'Remission - Mark state as in remission', value: 'remission' },
                    { name: 'Delete - Remove state permanently', value: 'delete' }
                ))
            .addStringOption(opt => opt
                .setName('state_name')
                .setDescription('State name (required for edit/remission/delete)')
                .setRequired(false)))

        /*// SETTINGS subcommand
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Configure state settings')
            .addStringOption(opt => opt
                .setName('state_name')
                .setDescription('State name')
                .setRequired(true)),*/,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'state');

        if (!system && subcommand !== 'view')
            return await interaction.reply({
                content: '❌ You need to set up a system first. Use `/system` to get started.',
                ephemeral: true
            });

        const action = interaction.options.getString('action');
        switch (action) {
            case 'list': return await handleShowList(interaction, user, system); break;
            case 'show': return await handleShow(interaction, user, system); break;
            case 'new': return await handleNew(interaction, user, system); break;
            case 'edit': return await handleEdit(interaction, user, system); break;
            case 'settings': return await handleSettings(interaction, user, system); break;
            case 'remission': return await handleRemission(interaction, user, system); break;
            case 'delete': return await handleDelete(interaction, user, system); break;
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ==== EMBED BUILDERS (State-specific) =====

// Build the state list embed
function buildStateListEmbed(states, page, system, showFullList, fallbackName) {
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
            const name = state.name?.indexable || fallbackName || 'Unknown';
            const proxies = utils.formatProxies(state.proxy);
            return `**${name}** - ${proxies}`;
        }).join('\n');

        embed.addFields({ name: 'States', value: stateList });
    }

    return embed;
}

// Build the state card embed
async function buildStateCard(state, system, privacyBucket, closedCharAllowed = true, guildId = null, fallbackName = null) {
    const embed = new EmbedBuilder();

    const session = { mode: null, syncWithDiscord: state.syncWithApps?.discord, serverId: guildId };

    // Color priority: state.color > system.color > none
    const color = utils.getEntityEmbedColor(state, system);
    const description = utils.getDiscordOrDefault(state, 'description');
    const displayName = closedCharAllowed
        ? (state.name?.display || state.name?.indexable)
        : (state.name?.closedNameDisplay || state.name?.display || state.name?.indexable);

    // Header/Author — proxy avatar priority
    const proxyAvatar = utils.resolveProxyAvatarUrl(state, session);
    const systemDisplayName = utils.getDisplayName(system, closedCharAllowed);

    embed.setAuthor({
        name: `${state.name?.indexable || fallbackName || 'Unknown'} (from ${systemDisplayName})`,
        iconURL: proxyAvatar || undefined
    });

    embed.setTitle(displayName || fallbackName || 'Unknown State');
    if (color) embed.setColor(color);
    if (description) embed.setDescription(description);

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
    for (const [type, groupNames] of Object.entries(groupsByType)) identificationInfo += `**${type}:** ${groupNames.join(', ')}\n`;
    if (state.signoff) identificationInfo += `**Sign-off:** ${state.signoff}\n`;
    if (state.proxy?.length > 0) identificationInfo += `**Proxies:** ${utils.formatProxies(state.proxy)}\n`;
    //identificationInfo += `**Display Name:** ${displayName}\n`;
    if (state.name?.aliases?.length > 0) identificationInfo += `**Aliases:** ${state.name.aliases.join(', ')}\n`;
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

    // Caution field
    if (state.caution && (state.caution.c_type || state.caution.detail || state.caution.triggers?.length > 0)) {
        let cautionInfo = '';

        if (state.caution.c_type) cautionInfo += `**Type:** ${state.caution.c_type}\n`;
        if (state.caution.detail) cautionInfo += `**Details:** ${state.caution.detail}\n`;
        if (state.caution.triggers?.length > 0) {
            const triggerNames = state.caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length > 0) cautionInfo += `**Triggers:** ${triggerNames.join(', ')}\n`;
        }
        if (cautionInfo) {
            embed.addFields({
                name: '⚠️ Caution',
                value: cautionInfo.trim(),
                inline: false
            });
        }
    }

    // Thumbnail — avatar priority
    const avatar = utils.resolveAvatarUrl(state, session);
    if (avatar) embed.setThumbnail(avatar);

    // Banner
    const banner = utils.resolveBannerUrl(state, session);
    if (banner) embed.setImage(banner);

    return embed;
}

// Build the edit interface for a state
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

    const uploadRow = session.uploadMode
        ? new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`state_upload_select_${session.id}`)
                .setPlaceholder('Choose media type to upload...')
                .addOptions(utils.buildUploadOptions(session)),
            new ButtonBuilder().setCustomId(`state_upload_back_${session.id}`).setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        )
        : new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_upload_media_${session.id}`).setLabel('Upload Media').setStyle(ButtonStyle.Secondary).setEmoji('📎')
        );

    return { embed, components: [selectRow, modeRow, actionRow, uploadRow] };
}

// ==== COMMAND HANDLERS ====

// Handle /state menu
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

// Handle /state showlist
async function handleShowList(interaction, currentUser, currentSystem) {
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');
    const refuse_list_message = '❌ This user does not have a state list to show. They may not be registered, have not allowed you to view their list, or you might be blocked...';

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    // If viewing another user's list
    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;

        const User = require('../../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser || !otherUser.systemID) return await interaction.reply({ content: refuse_list_message, ephemeral: true });

        targetSystem = await System.findById(otherUser.systemID);

        if (!targetSystem) return await interaction.reply({ content: refuse_list_message, ephemeral: true });

        // Check if blocked
        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) 
            return await interaction.reply({ content: refuse_list_message, ephemeral: true });

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) return await interaction.reply({ content: '❌ Not registered. Use `/system` to set up first.', ephemeral: true });

    // Get all states for this system
    const states = await State.find({ _id: { $in: targetSystem.states?.IDs || [] } });

    //if (states.length === 0) return await interaction.reply({ content: '📭 No states registered for this system.', ephemeral: true });

    // Filter states based on visibility
    const visibleStates = states.filter(state =>
        utils.shouldShowEntity(state, privacyBucket, isOwner, false)
    ); 

    if (states.length === 0 || visibleStates.length === 0) return await interaction.reply({ content: '📭 No states registered.', ephemeral: true });

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

    const embed = buildStateListEmbed(visibleStates, 0, targetSystem, false, interaction.user?.displayName);
    const buttons = utils.buildListButtons(visibleStates.length, 0, isOwner, false, sessionId, 'state');

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: false });
}

// Handle /state show
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
        if (!otherUser || !otherUser.systemID) return await interaction.reply({ content: '❌ State cannot be found.', ephemeral: true });

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) return await interaction.reply({ content: '❌ State cannot be found.', ephemeral: true });

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) return await interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    // Find the state
    const state = await utils.findStateByName(stateName, targetSystem);
    if (!state) return await interaction.reply({ content: '❌ State cannot be found.', ephemeral: true });

    // Check visibility
    if (!isOwner && !utils.shouldShowEntity(state, privacyBucket, isOwner)) return await interaction.reply({ content: '❌ State cannot be found.', ephemeral: true });

    // Check closed character settings
    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    // Build the card
    const embed = await buildStateCard(state, targetSystem, privacyBucket, closedCharAllowed, interaction.guildId, interaction.user?.displayName);

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

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: false });
}

// Handle /state new
async function handleNew(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const indexable = stateName.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

    if (indexable) {
        const existingState = await utils.findStateByName(indexable, system);
        if (existingState) return await interaction.reply({ content: '❌ A state with this name already exists in your system.', ephemeral: true });
    }

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'new',
        stateDisplayName: stateName,
        stateIndexable: indexable,
        systemId: system._id,
        userId: user._id
    });

    // Show sync confirmation
    const { embed, buttons } = utils.buildSyncConfirmation('state', stateName, sessionId, 'new');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

// Handle /state edit
async function handleEdit(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);
    if (!state) return await interaction.reply({ content: '❌ State not found in your system.', ephemeral: true });

    if (state.systemID !== system._id.toString()) return await interaction.reply({ content: '❌ This state does not belong to your system.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'edit',
        stateId: state._id,
        systemId: system._id,
        mode: null,
        syncWithDiscord: state.syncWithApps?.discord || true
    });

    // Go straight to edit interface (sync is managed in settings)
    const { embed, components } = buildEditInterface(state, { id: sessionId }, system);
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// Handle /state remission
async function handleRemission(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);
    if (!state) return await interaction.reply({ content: '❌ State not found in your system.', ephemeral: true });

    // Update condition
    state.condition = 'remission';
    await state.save();
    await interaction.reply({
        content: `✅ **${utils.getDisplayName(state)}** has been marked as in remission.`,
        ephemeral: true
    });
}

//Handle /state delete
async function handleDelete(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);
    if (!state) return await interaction.reply({ content: '❌ State not found in your system.', ephemeral: true });

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
            `If this state is simply inactive, you can mark it as in remission or another condition instead. 😅`
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

// Handle /state settings
async function handleSettings(interaction, user, system) {
    const stateName = interaction.options.getString('state_name');
    const state = await utils.findStateByName(stateName, system);
    if (!state) return await interaction.reply({ content: '❌ State not found in your system.', ephemeral: true });

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
            },
            {
                name: 'Allow Pings',
                value: state.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled',
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
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`state_settings_allowping_${sessionId}`)
            .setLabel(state.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF')
            .setStyle(state.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const syncRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`state_settings_sync_${sessionId}`)
            .setLabel(state.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
            .setStyle(state.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(state.syncWithApps?.discord ? '✅' : '🔄')
    );

    await interaction.reply({ embeds: [embed], components: [buttons, syncRow], ephemeral: true });
}

// ==== BUTTON INTERACTION HANDLER ====

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle new user flow buttons
    if (customId.startsWith('new_user_')) 
        return await utils.handleNewUserButton(interaction, 'state');

    // (Removed: state_menu_showlist mock interaction — menu subcommand is commented out, dead code)

    // Extract session ID from custom ID
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

    // Handle list navigation
    if (customId.startsWith('state_list_prev_')) 
        session.page = Math.max(0, session.page - 1);

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
        const embed = buildStateListEmbed(states, session.page, system, session.showFullList, interaction.user?.displayName);
        const buttons = utils.buildListButtons(states.length, session.page, session.isOwner, session.showFullList, sessionId, 'state');
        return await interaction.update({ embeds: [embed], components: buttons });
    }

    // Handle show full info
    if (customId.startsWith('state_show_full_')) {
        const state = await State.findById(session.stateId);
        const system = await System.findById(session.systemId);
        const embed = await buildStateCard(state, system, null, true, interaction.guildId, interaction.user?.displayName);

        // Add metadata
        let metadataInfo = '';
        if (state.metadata?.addedAt) 
            metadataInfo += `**Added:** ${utils.formatDate(state.metadata.addedAt)}\n`;
        if (state.genesisDate) 
            metadataInfo += `**Genesis Date:** ${utils.formatDate(state.genesisDate)}\n`;
        if (state.addedAt) 
            metadataInfo += `**Added At:** ${utils.formatDate(state.addedAt)}\n`;
        if (state.discord?.metadata?.messageCount)
            metadataInfo += `**Discord Messages:** ${state.discord.metadata.messageCount}\n`;
        if (state.discord?.metadata?.lastMessageTime)
            metadataInfo += `**Last Message:** ${utils.formatDate(state.discord.metadata.lastMessageTime)}\n`;

        if (metadataInfo)
            embed.addFields({ name: '📊 Metadata', value: metadataInfo.trim(), inline: false });

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
                    ...(session.stateIndexable && { indexable: session.stateIndexable }),
                    display: session.stateDisplayName
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
        const state = await State.findById(session.stateId);
        const { embed, components } = buildEditInterface(state, session);
        return await interaction.update({ embeds: [embed], components });
    }

    if (customId.startsWith('state_edit_mode_server_')) {
        const state = await State.findById(session.stateId);
        if (session.mode === 'server') {
            session.mode = null;
            delete session.serverId;
        } else {
            session.mode = 'server';
            session.serverId = interaction.guildId;
            utils.ensureServerEntry(state, interaction.guildId, interaction.guild?.name);
        }
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

    // Upload Media → show select menu
    if (customId.startsWith('state_upload_media_')) {
        session.uploadMode = true;
        const state = await State.findById(session.stateId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(state, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload Back → return to button
    if (customId.startsWith('state_upload_back_')) {
        session.uploadMode = false;
        const state = await State.findById(session.stateId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(state, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload type selected → prompt for attachment
    if (customId.startsWith('state_upload_select_')) {
        const value = interaction.values[0];

        const typeMap = {
            mask_avatar: { fieldLabel: 'mask avatar', mediaType: 'avatar', path: 'mask' },
            mask_davatar: { fieldLabel: 'mask discord avatar', mediaType: 'avatar', path: 'mask_discord' },
            mask_proxy: { fieldLabel: 'mask proxy avatar', mediaType: 'proxyAvatar', path: 'mask_discord' },
            mask_banner: { fieldLabel: 'mask banner', mediaType: 'banner', path: 'mask_discord' },
            server_avatar: { fieldLabel: 'server avatar', mediaType: 'avatar', path: 'server' },
            server_banner: { fieldLabel: 'server banner', mediaType: 'banner', path: 'server' },
            server_proxy: { fieldLabel: 'server proxy avatar', mediaType: 'proxyAvatar', path: 'server' },
            primary_avatar: { fieldLabel: 'primary avatar', mediaType: 'avatar', path: 'primary' },
            discord_avatar: { fieldLabel: 'discord avatar', mediaType: 'avatar', path: 'discord' },
            proxy_avatar: { fieldLabel: 'proxy avatar', mediaType: 'proxyAvatar', path: 'discord' },
            banner: { fieldLabel: 'banner', mediaType: 'banner', path: 'discord' }
        };

        const config = typeMap[value];
        if (!config) {
            return await interaction.reply({ content: '❌ Invalid upload type.', ephemeral: true });
        }

        const system = await System.findById(session.systemId);

        await interaction.reply({
            content: `📎 Please send the image for your **${config.fieldLabel}**. You have 60 seconds.`,
            ephemeral: true
        });

        try {
            const collected = await interaction.channel.awaitMessages({
                filter: m => m.author.id === interaction.user.id && m.attachments.size > 0,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const attachment = collected.first().attachments.first();
            const state = await State.findById(session.stateId);
            const bucket = utils.resolveUploadBucket(session.syncWithDiscord, config.path);
            const result = await utils.handleAttachmentUpload(attachment, config.fieldLabel, 'State', interaction.user.id, bucket);

            if (result.success) {
                if (config.path === 'mask') {
                    const oldMedia = state.mask?.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    if (!state.mask) state.mask = {};
                    state.mask.avatar = result.media;
                } else if (config.path === 'mask_discord') {
                    if (!state.mask) state.mask = {};
                    if (!state.mask.discord) state.mask.discord = { image: {} };
                    if (!state.mask.discord.image) state.mask.discord.image = {};
                    const oldMedia = state.mask.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    state.mask.discord.image[config.mediaType] = result.media;
                } else if (config.path === 'server') {
                    const serverEntry = utils.ensureServerEntry(state, session.serverId, interaction.guild?.name);
                    const oldMedia = serverEntry[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    serverEntry[config.mediaType] = result.media;
                } else if (config.path === 'primary') {
                    const oldMedia = state.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    state.avatar = result.media;
                } else {
                    if (!state.discord) state.discord = {};
                    if (!state.discord.image) state.discord.image = {};
                    const oldMedia = state.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    state.discord.image[config.mediaType] = result.media;
                }

                await state.save();
                await proxyMessageHandler.invalidateDisplayCache(state._id);
                const { embed, components } = buildEditInterface(state, session, system);
                return await interaction.editReply({ content: result.message, embeds: [embed], components });
            } else {
                return await interaction.editReply({ content: result.message });
            }
        } catch (err) {
            return await interaction.editReply({ content: '⏰ Upload timed out. Please try again.' });
        }
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

        // Clean up reverse references from alters and groups
        const stateId = session.stateId.toString();
        await Alter.updateMany({ states: stateId }, { $pull: { states: stateId } });
        await Group.updateMany({ stateIDs: stateId }, { $pull: { stateIDs: stateId } });

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

    // Settings → Mask Settings (transition to edit interface with mask mode active)
    if (customId.startsWith('state_settings_mask_')) {
        session.type = 'edit';
        session.mode = 'mask';
        const state = await State.findById(session.stateId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(state, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Settings → Toggle Sync with Discord
    if (customId.startsWith('state_settings_sync_')) {
        const state = await State.findById(session.stateId);
        state.syncWithApps = { discord: !state.syncWithApps?.discord };
        await state.save();

        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure settings for this state.')
            .addFields(
                { name: 'Closed Name Display', value: state.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: state.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: state.condition || '*None*', inline: true },
                { name: 'Allow Pings', value: state.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Sync with Discord', value: state.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(state, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`state_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`state_settings_allowping_${sessionId}`).setLabel(state.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(state.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`state_settings_sync_${sessionId}`)
                .setLabel(state.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(state.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(state.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Toggle Allow Pings
    if (customId.startsWith('state_settings_allowping_')) {
        const state = await State.findById(session.stateId);
        if (!state.setting) state.setting = {};
        state.setting.allowPing = state.setting.allowPing === false ? true : (state.setting.allowPing === undefined ? false : !state.setting.allowPing);
        await state.save();

        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure settings for this state.')
            .addFields(
                { name: 'Closed Name Display', value: state.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: state.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: state.condition || '*None*', inline: true },
                { name: 'Allow Pings', value: state.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Sync with Discord', value: state.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(state, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`state_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`state_settings_allowping_${sessionId}`).setLabel(state.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(state.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`state_settings_sync_${sessionId}`)
                .setLabel(state.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(state.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(state.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Privacy Settings
    if (customId.startsWith('state_settings_privacy_')) {
        const state = await State.findById(session.stateId);
        const sys = await System.findById(session.systemId);

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure who can see what information about this state.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const privacy = state.setting?.privacy?.find(p => p.bucket === bucket.name);
                let status = 'Default (visible)';
                if (privacy?.settings?.hidden === false) status = '❌ Hidden';
                else if (privacy?.settings?.hidden === true) status = '✅ Visible';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        } else {
            embed.addFields({ name: 'No buckets', value: 'No privacy buckets configured.', inline: false });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`state_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`state_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy → Toggle Hidden
    if (customId.startsWith('state_privacy_toggle_hidden_')) {
        const state = await State.findById(session.stateId);
        const sys = await System.findById(session.systemId);

        if (!sys.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const bucketOptions = sys.privacyBuckets.map(b => {
            const privacy = state.setting?.privacy?.find(p => p.bucket === b.name);
            const isHidden = privacy?.settings?.hidden === false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${isHidden ? 'Hidden' : 'Visible'})`)
                .setValue(b.name)
                .setEmoji(isHidden ? '❌' : '✅');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`state_privacy_toggle_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle hidden...')
            .addOptions(bucketOptions);

        return await interaction.update({ content: 'Select a bucket to toggle hidden/visible:', embeds: [], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }

    // Privacy → Toggle Allow Pings
    if (customId.startsWith('state_privacy_toggle_ping_')) {
        const state = await State.findById(session.stateId);
        const sys = await System.findById(session.systemId);

        if (!sys.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const bucketOptions = sys.privacyBuckets.map(b => {
            const privacy = state.setting?.privacy?.find(p => p.bucket === b.name);
            const pingAllowed = privacy?.settings?.allowPing !== false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${pingAllowed ? 'Pings ON' : 'Pings OFF'})`)
                .setValue(b.name)
                .setEmoji(pingAllowed ? '🔔' : '🔕');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`state_privacy_toggle_ping_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle pings...')
            .addOptions(bucketOptions);

        return await interaction.update({ content: 'Select a bucket to toggle allow pings:', embeds: [], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }

    // Privacy → Back to Settings
    if (customId.startsWith('state_privacy_back_')) {
        const state = await State.findById(session.stateId);
        session.type = 'settings';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure settings for this state.')
            .addFields(
                { name: 'Closed Name Display', value: state.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: state.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: state.condition || '*None*', inline: true }
            );

        const color = utils.getEntityEmbedColor(state, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`state_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭')
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`state_settings_sync_${sessionId}`)
                .setLabel(state.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(state.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(state.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Edit → Edit Groups (modal to add/remove group memberships)
    if (customId.startsWith('state_edit_groups_')) {
        const state = await State.findById(session.stateId);
        const currentGroups = await Group.find({ _id: { $in: state.groupIDs || [] } });
        const currentGroupNames = currentGroups.map(g => g.name?.indexable).filter(Boolean);

        const modal = new ModalBuilder()
            .setCustomId(`state_edit_groups_modal_${sessionId}`)
            .setTitle('Edit Group Memberships');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('group_names')
                .setLabel('Groups (comma-separated indexable names)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(currentGroupNames.join(', '))
                .setPlaceholder('Enter group names to assign this state to')
                .setRequired(false)
                .setMaxLength(1000)
        ));
        return await interaction.showModal(modal);
    }

    // Edit → Settings transition (from buildEditInterface action row)
    if (customId.startsWith('state_edit_settings_')) {
        const state = await State.findById(session.stateId);
        session.type = 'settings';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure settings for this state.')
            .addFields(
                { name: 'Closed Name Display', value: state.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: state.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: state.condition || '*None*', inline: true }
            );

        const color = utils.getEntityEmbedColor(state, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`state_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`state_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`state_settings_back_${sessionId}`).setLabel('Back to Edit').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Settings → Back to Edit
    if (customId.startsWith('state_settings_back_')) {
        const state = await State.findById(session.stateId);
        session.type = 'edit';
        session.mode = null;
        const { embed, components } = buildEditInterface(state, session, system);
        return await interaction.update({ embeds: [embed], components });
    }
}

// ==== SELECT MENU HANDLER ====

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

    // Privacy toggle select
    if (interaction.customId.startsWith('state_privacy_toggle_select_')) {
        const state = await State.findById(session.stateId);
        const sys = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!state.setting) state.setting = {};
        if (!state.setting.privacy) state.setting.privacy = [];

        let privacy = state.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            state.setting.privacy.push(privacy);
        }

        privacy.settings.hidden = privacy.settings.hidden === false ? true : false;
        await state.save();

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure who can see what information about this state.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const p = state.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (visible)';
                if (p?.settings?.hidden === false) status = '❌ Hidden';
                else if (p?.settings?.hidden === true) status = '✅ Visible';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`state_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy toggle ping select
    if (interaction.customId.startsWith('state_privacy_toggle_ping_select_')) {
        const state = await State.findById(session.stateId);
        const sys = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!state.setting) state.setting = {};
        if (!state.setting.privacy) state.setting.privacy = [];

        let privacy = state.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            state.setting.privacy.push(privacy);
        }

        privacy.settings.allowPing = privacy.settings.allowPing === false ? true : false;
        await state.save();

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(state)}`)
            .setDescription('Configure who can see what information about this state.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const p = state.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (pings allowed)';
                if (p?.settings?.allowPing === false) status = '🔕 Pings disabled';
                else if (p?.settings?.allowPing === true) status = '🔔 Pings allowed';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`state_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`state_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`state_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
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
            return await interaction.reply({ content: '❌ Unknown option selected.', ephemeral: true });
    }

    await interaction.showModal(modal);
}

// ==== MODAL SUBMIT HANDLER ====

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

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
        await proxyMessageHandler.invalidateDisplayCache(state._id);
    }

    // Handle connected alters modal
    if (interaction.customId.startsWith('state_edit_alters_modal_')) {
        const alterNamesInput = interaction.fields.getTextInputValue('alter_names');
        const alterNames = utils.parseCommaSeparated(alterNamesInput);

        const system = await System.findById(session.systemId);
        const allAlters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });

        const matchingAlterIds = [];
        for (const name of alterNames) {
            const alter = allAlters.find(a => a.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (alter) matchingAlterIds.push(alter._id.toString());
        }

        // Calculate diff for reverse sync (alter.states)
        const oldAlterIds = state.alters || [];
        const removedAlterIds = oldAlterIds.filter(id => !matchingAlterIds.includes(id));
        const addedAlterIds = matchingAlterIds.filter(id => !oldAlterIds.includes(id));

        state.alters = matchingAlterIds;
        await state.save();

        // Sync reverse: alter.states (connected_id entries)
        if (removedAlterIds.length > 0) {
            await Alter.updateMany({ _id: { $in: removedAlterIds } }, { $pull: { states: { connected_id: state._id.toString() } } });
        }
        if (addedAlterIds.length > 0) {
            for (const alterId of addedAlterIds) {
                const alter = allAlters.find(a => a._id.toString() === alterId);
                if (alter) {
                    await Alter.updateOne(
                        { _id: alterId },
                        { $addToSet: { states: { connected_id: state._id.toString(), name: { indexable: state.name?.indexable, display: state.name?.display } } } }
                    );
                }
            }
        }
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
        } else state.proxy = [];

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
        await proxyMessageHandler.invalidateDisplayCache(state._id);
    }

    // Handle caution info modal
    if (interaction.customId.startsWith('state_edit_caution_modal_')) {
        if (!state.caution) state.caution = {};

        const cautionType = interaction.fields.getTextInputValue('caution_type');
        const cautionDetail = interaction.fields.getTextInputValue('caution_detail');
        const triggerNames = interaction.fields.getTextInputValue('trigger_names');

        state.caution.c_type = cautionType || undefined;
        state.caution.detail = cautionDetail || undefined;

        if (triggerNames) 
            state.caution.triggers = utils.parseCommaSeparated(triggerNames).map(name => ({ name }));
        else state.caution.triggers = [];

        await state.save();
    }

    // Handle settings modals
    if (interaction.customId.startsWith('state_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');

        if (!state.name) state.name = {};
        state.name.closedNameDisplay = closedName || null;

        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);

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

    // Edit groups modal
    if (interaction.customId.startsWith('state_edit_groups_modal_')) {
        const groupNamesInput = interaction.fields.getTextInputValue('group_names');
        const groupNames = utils.parseCommaSeparated(groupNamesInput);

        const system = await System.findById(session.systemId);
        const allGroups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });

        const matchingGroupIds = [];
        for (const name of groupNames) {
            const group = allGroups.find(g => g.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (group) matchingGroupIds.push(group._id.toString());
        }

        // Calculate diff for reverse sync (group.stateIDs)
        const oldGroupIds = state.groupIDs || [];
        const removedGroupIds = oldGroupIds.filter(id => !matchingGroupIds.includes(id));
        const addedGroupIds = matchingGroupIds.filter(id => !oldGroupIds.includes(id));

        state.groupIDs = matchingGroupIds;
        await state.save();

        // Sync reverse: group.stateIDs
        if (removedGroupIds.length > 0) {
            await Group.updateMany({ _id: { $in: removedGroupIds } }, { $pull: { stateIDs: state._id.toString() } });
        }
        if (addedGroupIds.length > 0) {
            await Group.updateMany({ _id: { $in: addedGroupIds } }, { $addToSet: { stateIDs: state._id.toString() } });
        }
    }

    // Return to edit interface for edit modals
    session.id = sessionId;
    const { embed, components } = buildEditInterface(state, session);
    await interaction.update({ embeds: [embed], components });
}