// (/alter) - Systemiser Alter Management Command

// (/alter menu)
// (/alter showlist ) (click button to show full in ephemeral)
// (/alter showlist user:[@user] userID:[string])

// (/alter show user:[@user] userID:[string] alter_name:[string]) (click button to show all info in ephemeral)
// (/alter show alter_name:[string])

// (OLD)
// (/alter new alter_name:[string])
// (/alter delete alter_name:[string])
// (/alter dormant alter_name:[string])

// (/alter alter_name:[string] edit (have the select menu of what to edit (card info, personal info, proxy info, image info, caution info ) and have a buttons to (enter mask mode, open alter settings, edit groups, edit states))
// (/alter alter_name:[string] settings

// (NEW)
// (/alter view [list/show])
// (/alter manage [new/edit/settings] alter_name:[string]) (delete will be in settings)

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

const Alter = require('../../../schemas/alter');
const System = require('../../../schemas/system');
const Group = require('../../../schemas/group');
const State = require('../../../schemas/state');
const utils = require('../../functions/bot_utils');
const proxyMessageHandler = require('../proxy-message');

const { getSystemTerm, getAlterTerm } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alter')
        .setDescription('Manage your alters')

        // VIEW subcommand
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View alter-focused information')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to view')
                .setRequired(true)
                .addChoices(
                    { name: 'List - View all alters', value: 'list' },
                    { name: 'Show - View specific alter details', value: 'show' }
                ))
            .addStringOption(opt => opt
                .setName('alter_name')
                .setDescription('Alter name (required for "show")')
                .setRequired(false))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('View another user\'s alters')
                .setRequired(false))
            /*.addBooleanOption(opt => opt
                .setName('show_all')
                .setDescription('Show hidden alters (list only)')
                .setRequired(false))*/
            )

        // MANAGE subcommand
        .addSubcommand(sub => sub
            .setName('manage')
            .setDescription('Create, edit, and delete alter information')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to do')
                .setRequired(true)
                .addChoices(
                    { name: 'New - Create new alter profile', value: 'new' },
                    { name: 'Edit - Modify info for existing alter', value: 'edit' },
                    { name: 'Settings - Edit settings for existing alter', value: 'settings'},
                    { name: 'Dormant - Mark alter as dormant', value: 'dormant' },
                    { name: 'Delete - Remove alter permanently', value: 'delete' }
                ))
            .addStringOption(opt => opt
                .setName('alter_name')
                .setDescription('Give Alter name (indexable version preferred)')
                .setRequired(true)))

        // SETTINGS subcommand
        /*.addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Configure alter settings')
            .addStringOption(opt => opt
                .setName('alter_name')
                .setDescription('Alter name')
                .setRequired(true)))*/,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'alter');

        if (!system && subcommand !== 'view') 
            return await interaction.reply({
                content: '❌ Not registered. Use `/system` to get started.',
                ephemeral: true
            });

        const action = interaction.options.getString('action');
        switch (action) {
            case 'list': return await handleShowList(interaction, user, system); break;
            case 'show': return await handleShow(interaction, user, system); break;
            case 'new': return await handleNew(interaction, user, system); break;
            case 'edit': return await handleEdit(interaction, user, system); break;
            case 'settings': return await handleSettings(interaction, user, system); break;
            case 'dormant': return await handleDormant(interaction, user, system); break;
            case 'delete': return await handleDelete(interaction, user, system); break;
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ==== EMBED BUILDERS ====

function buildAlterListEmbed(alters, page, system, showFullList) {
    const pageAlters = utils.getPageItems(alters, page);
    const totalPages = utils.getTotalPages(alters.length);

    const embed = new EmbedBuilder()
        .setTitle(`${utils.getDisplayName(system)}'s Alters`)
        .setDescription(showFullList ? '📋 Showing full list (including hidden)' : '📋 Alter List')
        .setFooter({
            text: `Page ${page + 1}/${totalPages} • ${alters.length} alter${alters.length !== 1 ? 's' : ''}`
        });

    // Use system color if available
    const embedColor = utils.getSystemEmbedColor(system);
    if (embedColor) embed.setColor(embedColor);

    if (pageAlters.length === 0) {
        embed.addFields({ name: 'No alters', value: 'No alters to display on this page.' });
    } else {
        const alterList = pageAlters.map(alter => {
            const name = alter.name?.indexable || 'Unknown';
            const proxies = utils.formatProxies(alter.proxy);
            return `**${name}** - ${proxies}`;
        }).join('\n');

        embed.addFields({ name: 'Alters', value: alterList });
    }

    return embed;
}

async function buildAlterCard(alter, system, privacyBucket, closedCharAllowed = true, guildId = null) {
    const embed = new EmbedBuilder();

    const session = { mode: null, syncWithDiscord: alter.syncWithApps?.discord, serverId: guildId };

    // Color priority: alter.color > system.color > none
    const color = utils.getEntityEmbedColor(alter, system);
    const description = utils.getDiscordOrDefault(alter, 'description');
    const displayName = closedCharAllowed
        ? (alter.name?.display || alter.name?.indexable)
        : (alter.name?.closedNameDisplay || alter.name?.display || alter.name?.indexable);

    // Header/Author — proxy avatar priority
    const proxyAvatar = utils.resolveProxyAvatarUrl(alter, session);
    const systemDisplayName = utils.getDisplayName(system, closedCharAllowed);
    embed.setAuthor({
        name: `${alter.name?.indexable || 'unknown'} (from ${systemDisplayName})`,
        iconURL: proxyAvatar || undefined
    });

    embed.setTitle(displayName || '*No Name*');
    if (color) embed.setColor(color);
    if (description) embed.setDescription(description); 

    const groups = await Group.find({ _id: { $in: alter.groupsIDs || [] } }); // Get groups for this alter
    // Organize groups by type
    const groupsByType = {};
    for (const group of groups) {
        const typeName = group.type?.name || 'Other';
        if (!groupsByType[typeName]) groupsByType[typeName] = [];
        groupsByType[typeName].push(utils.getDisplayName(group, closedCharAllowed));
    }

    // Personal Info field
    let personalInfo = '';
    if (alter.pronouns?.length > 0) personalInfo += `**Pronouns:** ${alter.pronouns.join(', ')}\n`;
    if (alter.birthday) personalInfo += `**Birthday:** ${utils.formatDate(alter.birthday)}\n`;
    if (alter.name?.aliases?.length > 0) personalInfo += `**Aliases:** ${alter.name.aliases.join(', ')}\n`;
    if (personalInfo) {
        embed.addFields({
            name: '👤 Personal Info',
            value: personalInfo.trim(),
            inline: false
        });
    }

    // Identification Info field
    let identificationInfo = '';
    //identificationInfo += `**Display Name:** ${displayName}\n`;
    if (alter.signoff) identificationInfo += `**Sign-off:** ${alter.signoff}\n`;
    if (alter.proxy?.length > 0) identificationInfo += `**Proxies:** ${utils.formatProxies(alter.proxy)}\n`; 
    for (const [type, groupNames] of Object.entries(groupsByType)) {
        identificationInfo += `**${type}:** ${groupNames.join(', ')}\n`;
    }
    if (identificationInfo) {
        embed.addFields({
            name: '🏷️ ID\'s',
            value: identificationInfo.trim() || 'None',
            inline: false
        });
    }

    // Caution field
    if (alter.caution && (alter.caution.c_type || alter.caution.detail || alter.caution.triggers?.length > 0)) {
        let cautionInfo = '';
        if (alter.caution.c_type) cautionInfo += `**Type:** ${alter.caution.c_type}\n`;
        if (alter.caution.detail) cautionInfo += `**Details:** ${alter.caution.detail}\n`;
        if (alter.caution.triggers?.length > 0) {
            const triggerNames = alter.caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length > 0) cautionInfo += `**Triggers:** ${triggerNames.join(', ')}\n`;
        }
        if (cautionInfo) {
            embed.addFields({
                name: '⚠️ Cautions',
                value: cautionInfo.trim(),
                inline: false
            });
        }
    }

    // Thumbnail — avatar priority
    const avatar = utils.resolveAvatarUrl(alter, session);
    if (avatar) embed.setThumbnail(avatar);

    // Banner
    const banner = utils.resolveBannerUrl(alter, session);
    if (banner) embed.setImage(banner);

    return embed;
}

function buildEditInterface(alter, session, system = null) {
    const embed = new EmbedBuilder()
        .setTitle(`Editing: ${utils.getDisplayName(alter)}`)
        .setDescription(session.mode
            ? `Currently in **${session.mode.toUpperCase()} MODE**\n\nSelect what you would like to edit.`
            : 'Select what you would like to edit from the dropdown menu below.'
        );

    // Color priority: alter.color > system.color > none
    const color = utils.getEntityEmbedColor(alter, system);
    if (color) embed.setColor(color);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`alter_edit_select_${session.id}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Card Info').setDescription('Edit name, description, color').setValue('card_info').setEmoji('🎴'),
            new StringSelectMenuOptionBuilder().setLabel('Personal Info').setDescription('Edit pronouns, birthday, aliases').setValue('personal_info').setEmoji('👤'),
            new StringSelectMenuOptionBuilder().setLabel('Proxy Info').setDescription('Edit proxy tags and sign-off').setValue('proxy_info').setEmoji('💬'),
            new StringSelectMenuOptionBuilder().setLabel('Image Info').setDescription('Edit avatar and banner URLs').setValue('image_info').setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder().setLabel('Caution Info').setDescription('Edit caution type, details, and triggers').setValue('caution_info').setEmoji('⚠️')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const modeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`alter_edit_mode_mask_${session.id}`)
            .setLabel(session.mode === 'mask' ? 'Exit Mask Mode' : 'Enter Mask Mode')
            .setStyle(session.mode === 'mask' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`alter_edit_mode_server_${session.id}`)
            .setLabel(session.mode === 'server' ? 'Exit Server Mode' : 'Enter Server Mode')
            .setStyle(session.mode === 'server' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🏠')
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`alter_edit_settings_${session.id}`).setLabel('Alter Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId(`alter_edit_groups_${session.id}`).setLabel('Edit Groups').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
        new ButtonBuilder().setCustomId(`alter_edit_states_${session.id}`).setLabel('Edit States').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId(`alter_edit_done_${session.id}`).setLabel('Done').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    const uploadRow = session.uploadMode
        ? new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`alter_upload_select_${session.id}`)
                .setPlaceholder('Choose media type to upload...')
                .addOptions(utils.buildUploadOptions(session)),
            new ButtonBuilder().setCustomId(`alter_upload_back_${session.id}`).setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        )
        : new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_upload_media_${session.id}`).setLabel('Upload Media').setStyle(ButtonStyle.Secondary).setEmoji('📎')
        );

    return { embed, components: [selectRow, modeRow, actionRow, uploadRow] };
}

// ==== COMMAND HANDLERS ====

/*async function handleMenu(interaction, user, system) {
    const embed = new EmbedBuilder()
        .setTitle('🎭 Alter Management')
        .setDescription('Select a button to start managing your alters.')
        .setFooter({ text: 'Use the buttons below to navigate' });

    // Use system color if available
    const color = utils.getSystemEmbedColor(system);
    if (color) embed.setColor(color);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('alter_menu_showlist').setLabel('Show List').setStyle(ButtonStyle.Primary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('alter_menu_select').setLabel('Select Alter').setStyle(ButtonStyle.Secondary).setEmoji('🔍')
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}*/

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
                content: '❌ This user does not have an alter list to show. They may not be registered...',
                ephemeral: true
            });
        }

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) {
            return await interaction.reply({
                content: '❌ This user does not have an alter list to show. They may not be registered...',
                ephemeral: true
            });
        }

        // Check if blocked
        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) {
            return await interaction.reply({
                content: '❌ This user does not have an alter list to show. They may not be registered...',
                ephemeral: true
            });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);

        // Check if system is hidden
        const systemPrivacy = targetSystem.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
        if (systemPrivacy?.settings?.hidden === false) {
            return await interaction.reply({
                content: '❌ This user does not have an alter list to show. They may not be registered...',
                ephemeral: true
            });
        }
    }

    if (!targetSystem) {
        return await interaction.reply({
            content: '❌ Not registered. Use `/system` to set up first.',
            ephemeral: true
        });
    }

    // Get all alters for this system
    const alters = await Alter.find({ _id: { $in: targetSystem.alters?.IDs || [] } });

    if (alters.length === 0) 
        return await interaction.reply({ content: '📭 No alters found.', ephemeral: true });

    // Filter alters based on visibility
    const visibleAlters = alters.filter(alter => utils.shouldShowEntity(alter, privacyBucket, isOwner, false));

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'showlist',
        alters: visibleAlters,
        allAlters: alters,
        page: 0,
        showFullList: false,
        isOwner,
        systemId: targetSystem._id
    });

    const embed = buildAlterListEmbed(visibleAlters, 0, targetSystem, false);
    const buttons = utils.buildListButtons(visibleAlters.length, 0, isOwner, false, sessionId, 'alter');

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function handleShow(interaction, currentUser, currentSystem) {
    const alterName = interaction.options.getString('alter_name');
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;

        const User = require('../../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });
        if (!otherUser || !otherUser.systemID) return await interaction.reply({ content: '❌ Alter cannot be found.', ephemeral: true });

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) return await interaction.reply({ content: '❌ Alter cannot be found.', ephemeral: true });

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) return await interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const alter = await utils.findAlterByName(alterName, targetSystem);
    if (!alter) return await interaction.reply({ content: '❌ Alter cannot be found.', ephemeral: true });
    if (!isOwner && !utils.shouldShowEntity(alter, privacyBucket, isOwner)) return await interaction.reply({ content: '❌ Alter cannot be found.', ephemeral: true });

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildAlterCard(alter, targetSystem, privacyBucket, closedCharAllowed, interaction.guildId);

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'show',
        alterId: alter._id,
        systemId: targetSystem._id,
        isOwner
    });

    const buttons = isOwner ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`alter_show_full_${sessionId}`).setLabel('Show All Info').setStyle(ButtonStyle.Primary).setEmoji('📄')
    )] : [];

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function handleNew(interaction, user, system) {
    const alterName = interaction.options.getString('alter_name');
    const indexable = alterName.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

    if (indexable) {
        const existingAlter = await utils.findAlterByName(indexable, system);
        if (existingAlter) {
            return await interaction.reply({
                content: '❌ An alter with this indexable name already exists.',
                ephemeral: true
            });
        }
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'new',
        alterDisplayName: alterName,
        alterIndexable: indexable,
        systemId: system._id,
        userId: user._id
    });

    const { embed, buttons } = utils.buildSyncConfirmation('alter', alterName, sessionId, 'new');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleEdit(interaction, user, system) {
    const alterName = interaction.options.getString('alter_name');
    const alter = await utils.findAlterByName(alterName, system);

    if (!alter || alter.systemID !== system._id.toString()) return await interaction.reply({ content: '❌ Alter not found in your system.', ephemeral: true });
    if (alter.systemID !== system._id.toString()) return await interaction.reply({ content: '❌ This alter does not belong to your system.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'edit',
        alterId: alter._id,
        systemId: system._id,
        mode: null,
        syncWithDiscord: alter.syncWithApps?.discord || true
    });

    // Go straight to edit interface (sync is managed in settings)
    const { embed, components } = buildEditInterface(alter, { id: sessionId }, system);
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleDormant(interaction, user, system) {
    const alterName = interaction.options.getString('alter_name');
    const alter = await utils.findAlterByName(alterName, system);

    if (!alter) return await interaction.reply({ content: '❌ Alter not found.', ephemeral: true });

    alter.condition = 'dormant';
    await alter.save();

    await interaction.reply({
        content: `✅ **${utils.getDisplayName(alter)}** has been marked as dormant.`,
        ephemeral: true
    });
}

async function handleDelete(interaction, user, system) {
    const alterName = interaction.options.getString('alter_name');
    const alter = await utils.findAlterByName(alterName, system);

    if (!alter) return await interaction.reply({ content: '❌ Alter not found.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'delete',
        alterId: alter._id,
        systemId: system._id
    });

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Delete Alter Confirmation')
        .setDescription(`Are you sure you want to delete **${utils.getDisplayName(alter)}**?\n\nIf this alter is simply inactive, you can mark them as dormant or another condition instead.`)
        .setFooter({ text: 'This action cannot be undone!' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`alter_delete_dormant_${sessionId}`).setLabel('Mark as Dormant').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`alter_delete_condition_${sessionId}`).setLabel('Change Condition').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`alter_delete_confirm_${sessionId}`).setLabel('Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`alter_delete_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleSettings(interaction, user, system) {
    const alterName = interaction.options.getString('alter_name');
    const alter = await utils.findAlterByName(alterName, system);

    if (!alter) return await interaction.reply({ content: '❌ Alter not found.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'settings',
        alterId: alter._id,
        systemId: system._id
    });

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Settings: ${utils.getDisplayName(alter)}`)
        .setDescription('Configure settings for this alter.')
        .addFields(
            { name: 'Closed Name Display', value: alter.name?.closedNameDisplay || '*Not set*', inline: true },
            { name: 'Default Status', value: alter.setting?.default_status || '*Not set*', inline: true },
            { name: 'Current Condition', value: alter.condition || '*None*', inline: true },
            { name: 'Allow Pings', value: alter.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true }
        );

    // Color priority: alter.color > system.color > none
    const settingsColor = utils.getEntityEmbedColor(alter, system);
    if (settingsColor) embed.setColor(settingsColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`alter_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`alter_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`alter_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`alter_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId(`alter_settings_allowping_${sessionId}`).setLabel(alter.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(alter.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const syncRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`alter_settings_sync_${sessionId}`)
            .setLabel(alter.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
            .setStyle(alter.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(alter.syncWithApps?.discord ? '✅' : '🔄')
    );

    await interaction.reply({ embeds: [embed], components: [buttons, syncRow], ephemeral: true });
}

// ==== BUTTON HANDLER ====

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle new user flow
    if (customId.startsWith('new_user_')) return await utils.handleNewUserButton(interaction, 'alter');

    /*// Menu buttons
    if (customId === 'alter_menu_showlist') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        // Create a mock interaction with empty options
        const mockInteraction = {
            ...interaction,
            options: { getUser: () => null, getString: () => null }
        };
        return await handleShowList(mockInteraction, user, system);
    }*/

    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

    // List navigation
    if (customId.startsWith('alter_list_prev_')) session.page = Math.max(0, session.page - 1);
    if (customId.startsWith('alter_list_next_')) session.page = Math.min(utils.getTotalPages((session.showFullList ? session.allAlters : session.alters).length) - 1, session.page + 1);
    if (customId.startsWith('alter_list_toggle_')) {
        session.showFullList = !session.showFullList;
        session.page = 0;
    }
    if (customId.startsWith('alter_list_')) {
        const alters = session.showFullList ? session.allAlters : session.alters;
        const system = await System.findById(session.systemId);
        const embed = buildAlterListEmbed(alters, session.page, system, session.showFullList);
        const buttons = utils.buildListButtons(alters.length, session.page, session.isOwner, session.showFullList, sessionId, 'alter');
        return await interaction.update({ embeds: [embed], components: buttons });
    }

    // Show full info
    if (customId.startsWith('alter_show_full_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const embed = await buildAlterCard(alter, system, null, true, interaction.guildId);

        let metadataInfo = '';
        if (alter.metadata?.addedAt) metadataInfo += `**Added:** ${utils.formatDate(alter.metadata.addedAt)}\n`;
        if (alter.genesisDate) metadataInfo += `**Genesis Date:** ${utils.formatDate(alter.genesisDate)}\n`;
        if (alter.discord?.metadata?.messageCount) metadataInfo += `**Discord Messages:** ${alter.discord.metadata.messageCount}\n`;
        if (alter.discord?.metadata?.lastMessageTime) metadataInfo += `**Last Message:** ${utils.formatDate(alter.discord.metadata.lastMessageTime)}\n`;
        if (metadataInfo) embed.addFields({ name: '📊 Metadata', value: metadataInfo.trim(), inline: false });

        return await interaction.update({ embeds: [embed], components: [] });
    }

    // New/Edit sync buttons
    if (customId.startsWith('alter_new_sync_') || customId.startsWith('alter_edit_sync_')) {
        session.syncWithDiscord = customId.includes('_yes_');
        session.id = sessionId;

        if (customId.startsWith('alter_new_sync_')) {
            // Create the new alter
            const newAlter = new Alter({
                systemID: session.systemId,
                genesisDate: new Date(),
                syncWithApps: { discord: session.syncWithDiscord },
                name: { ...(session.alterIndexable && { indexable: session.alterIndexable }), display: session.alterDisplayName },
                metadata: { addedAt: new Date() }
            });
            await newAlter.save();
            await System.findByIdAndUpdate(session.systemId, { $push: { 'alters.IDs': newAlter._id.toString() } });
            session.alterId = newAlter._id;
            session.type = 'edit';
        } else {
            const alter = await Alter.findById(session.alterId);
            alter.syncWithApps = { discord: session.syncWithDiscord };
            await alter.save();
        }

        const alter = await Alter.findById(session.alterId);
        const { embed, components } = buildEditInterface(alter, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Edit mode toggles
    if (customId.startsWith('alter_edit_mode_mask_')) {
        session.mode = session.mode === 'mask' ? null : 'mask';
        const alter = await Alter.findById(session.alterId);
        const { embed, components } = buildEditInterface(alter, session);
        return await interaction.update({ embeds: [embed], components });
    }

    if (customId.startsWith('alter_edit_mode_server_')) {
        const alter = await Alter.findById(session.alterId);
        if (session.mode === 'server') {
            session.mode = null;
            delete session.serverId;
        } else {
            session.mode = 'server';
            session.serverId = interaction.guildId;
            utils.ensureServerEntry(alter, interaction.guildId, interaction.guild?.name);
        }
        const { embed, components } = buildEditInterface(alter, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Edit done
    if (customId.startsWith('alter_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Editing complete!', embeds: [], components: [] });
    }

    // Upload Media → show select menu
    if (customId.startsWith('alter_upload_media_')) {
        session.uploadMode = true;
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(alter, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload Back → return to button
    if (customId.startsWith('alter_upload_back_')) {
        session.uploadMode = false;
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(alter, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload type selected → prompt for attachment
    if (customId.startsWith('alter_upload_select_')) {
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
            const alter = await Alter.findById(session.alterId);
            const bucket = utils.resolveUploadBucket(session.syncWithDiscord, config.path);
            const result = await utils.handleAttachmentUpload(attachment, config.fieldLabel, 'Alter', interaction.user.id, bucket);

            if (result.success) {
                // Set media at correct path based on config
                if (config.path === 'mask') {
                    const oldMedia = alter.mask?.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    if (!alter.mask) alter.mask = {};
                    alter.mask.avatar = result.media;
                } else if (config.path === 'mask_discord') {
                    if (!alter.mask) alter.mask = {};
                    if (!alter.mask.discord) alter.mask.discord = { image: {} };
                    if (!alter.mask.discord.image) alter.mask.discord.image = {};
                    const oldMedia = alter.mask.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    alter.mask.discord.image[config.mediaType] = result.media;
                } else if (config.path === 'server') {
                    const serverEntry = utils.ensureServerEntry(alter, session.serverId, interaction.guild?.name);
                    const oldMedia = serverEntry[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    serverEntry[config.mediaType] = result.media;
                } else if (config.path === 'primary') {
                    const oldMedia = alter.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    alter.avatar = result.media;
                } else {
                    if (!alter.discord) alter.discord = {};
                    if (!alter.discord.image) alter.discord.image = {};
                    const oldMedia = alter.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
                    alter.discord.image[config.mediaType] = result.media;
                }

                await alter.save();
                await proxyMessageHandler.invalidateDisplayCache(alter._id);
                const { embed, components } = buildEditInterface(alter, session, system);
                return await interaction.editReply({ content: result.message, embeds: [embed], components });
            } else {
                return await interaction.editReply({ content: result.message });
            }
        } catch (err) {
            return await interaction.editReply({ content: '⏰ Upload timed out. Please try again.' });
        }
    }

    // Delete buttons
    if (customId.startsWith('alter_delete_dormant_')) {
        const alter = await Alter.findById(session.alterId);
        alter.condition = 'dormant';
        await alter.save();
        utils.deleteSession(sessionId);
        return await interaction.update({ content: `✅ **${utils.getDisplayName(alter)}** has been marked as dormant.`, embeds: [], components: [] });
    }

    if (customId.startsWith('alter_delete_condition_')) {
        const modal = new ModalBuilder().setCustomId(`alter_condition_modal_${sessionId}`).setTitle('Change Condition');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('condition_name')
                                  .setLabel('Condition Name')
                                  .setStyle(TextInputStyle.Short)
                                  .setPlaceholder('e.g., dormant, inactive, sleeping')
                                  .setRequired(true)
                                  .setMaxLength(50)
        ));
        return await interaction.showModal(modal);
    }

    if (customId.startsWith('alter_delete_confirm_')) {
        const system = await System.findById(session.systemId);
        system.alters.IDs = system.alters.IDs.filter(id => id !== session.alterId.toString());
        await system.save();

        // Clean up reverse references from groups and states
        const alterId = session.alterId.toString();
        await Group.updateMany({ alterIDs: alterId }, { $pull: { alterIDs: alterId } });
        await State.updateMany({ alters: alterId }, { $pull: { alters: alterId } });

        await Alter.findByIdAndDelete(session.alterId);
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Alter has been deleted.', embeds: [], components: [] });
    }

    if (customId.startsWith('alter_delete_cancel_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '❌ Deletion cancelled.', embeds: [], components: [] });
    }

    // Settings buttons
    if (customId.startsWith('alter_settings_closedname_')) {
        const alter = await Alter.findById(session.alterId);
        const modal = new ModalBuilder().setCustomId(`alter_settings_closedname_modal_${sessionId}`)
                                        .setTitle('Edit Closed Name Display');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('closed_name')
                                  .setLabel('Closed Name Display')
                                  .setStyle(TextInputStyle.Short)
                                  .setValue(alter.name?.closedNameDisplay || '')
                                  .setRequired(false)
                                  .setMaxLength(100)
        ));
        return await interaction.showModal(modal);
    }

    // Settings → Mask Settings (transition to edit interface with mask mode active)
    if (customId.startsWith('alter_settings_mask_')) {
        session.type = 'edit';
        session.mode = 'mask';
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const { embed, components } = buildEditInterface(alter, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Settings → Toggle Sync with Discord
    if (customId.startsWith('alter_settings_sync_')) {
        const alter = await Alter.findById(session.alterId);
        alter.syncWithApps = { discord: !alter.syncWithApps?.discord };
        await alter.save();

        // Refresh settings embed
        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure settings for this alter.')
            .addFields(
                { name: 'Closed Name Display', value: alter.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: alter.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: alter.condition || '*None*', inline: true },
                { name: 'Sync with Discord', value: alter.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(alter, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`alter_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭')
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`alter_settings_sync_${sessionId}`)
                .setLabel(alter.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(alter.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(alter.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Toggle Allow Pings
    if (customId.startsWith('alter_settings_allowping_')) {
        const alter = await Alter.findById(session.alterId);
        if (!alter.setting) alter.setting = {};
        alter.setting.allowPing = alter.setting.allowPing === false ? true : (alter.setting.allowPing === undefined ? false : !alter.setting.allowPing);
        await alter.save();

        // Refresh settings embed
        const system = await System.findById(session.systemId);
        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure settings for this alter.')
            .addFields(
                { name: 'Closed Name Display', value: alter.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: alter.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: alter.condition || '*None*', inline: true },
                { name: 'Allow Pings', value: alter.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true }
            );

        const color = utils.getEntityEmbedColor(alter, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`alter_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`alter_settings_allowping_${sessionId}`).setLabel(alter.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(alter.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`alter_settings_sync_${sessionId}`)
                .setLabel(alter.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(alter.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(alter.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Privacy Settings
    if (customId.startsWith('alter_settings_privacy_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure who can see what information about this alter.');

        // Show current privacy per bucket
        if (system.privacyBuckets?.length > 0) {
            for (const bucket of system.privacyBuckets) {
                const privacy = alter.setting?.privacy?.find(p => p.bucket === bucket.name);
                let status = 'Default (visible)';
                if (privacy?.settings?.hidden === false) status = '❌ Hidden';
                else if (privacy?.settings?.hidden === true) status = '✅ Visible';

                const fields = [];
                if (privacy?.settings) {
                    if (privacy.settings.avatar === false) fields.push('avatar:hidden');
                    if (privacy.settings.description === false) fields.push('description:hidden');
                    if (privacy.settings.pronouns === false) fields.push('pronouns:hidden');
                    if (privacy.settings.allowPing === false) fields.push('pings:disabled');
                    else if (privacy.settings.allowPing === true) fields.push('pings:allowed');
                }

                embed.addFields({
                    name: `Bucket: ${bucket.name}`,
                    value: `${status}${fields.length > 0 ? '\n' + fields.join(', ') : ''}`,
                    inline: false
                });
            }
        } else {
            embed.addFields({ name: 'No buckets', value: 'No privacy buckets configured. Use `/system manage` → Settings → Privacy Buckets to create some.', inline: false });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`alter_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`alter_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy → Toggle Hidden
    if (customId.startsWith('alter_privacy_toggle_hidden_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);

        if (!system.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured. Create some first.', ephemeral: true });
        }

        // Show select menu for bucket
        const bucketOptions = system.privacyBuckets.map(b => {
            const privacy = alter.setting?.privacy?.find(p => p.bucket === b.name);
            const isHidden = privacy?.settings?.hidden === false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${isHidden ? 'Hidden' : 'Visible'})`)
                .setValue(b.name)
                .setEmoji(isHidden ? '❌' : '✅');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`alter_privacy_toggle_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle hidden...')
            .addOptions(bucketOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.update({
            content: 'Select a privacy bucket to toggle hidden/visible:',
            embeds: [],
            components: [row]
        });
    }

    // Privacy → Toggle Allow Pings
    if (customId.startsWith('alter_privacy_toggle_ping_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);

        if (!system.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured. Create some first.', ephemeral: true });
        }

        const bucketOptions = system.privacyBuckets.map(b => {
            const privacy = alter.setting?.privacy?.find(p => p.bucket === b.name);
            const pingAllowed = privacy?.settings?.allowPing !== false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${pingAllowed ? 'Pings ON' : 'Pings OFF'})`)
                .setValue(b.name)
                .setEmoji(pingAllowed ? '🔔' : '🔕');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`alter_privacy_toggle_ping_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle pings...')
            .addOptions(bucketOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.update({
            content: 'Select a privacy bucket to toggle allow pings:',
            embeds: [],
            components: [row]
        });
    }

    // Privacy → Back to Settings
    if (customId.startsWith('alter_privacy_back_')) {
        const alter = await Alter.findById(session.alterId);
        session.type = 'settings';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure settings for this alter.')
            .addFields(
                { name: 'Closed Name Display', value: alter.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: alter.setting?.default_status || '*Not set*', inline: true },
                { name: 'Current Condition', value: alter.condition || '*None*', inline: true }
            );

        const color = utils.getEntityEmbedColor(alter, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_settings_closedname_${sessionId}`).setLabel('Edit Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`alter_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_privacy_${sessionId}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`alter_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭')
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`alter_settings_sync_${sessionId}`)
                .setLabel(alter.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(alter.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(alter.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Edit → Edit Groups (modal to add/remove group memberships)
    if (customId.startsWith('alter_edit_groups_')) {
        const alter = await Alter.findById(session.alterId);
        const currentGroups = await Group.find({ _id: { $in: alter.groupsIDs || [] } });
        const currentGroupNames = currentGroups.map(g => g.name?.indexable).filter(Boolean);

        const modal = new ModalBuilder()
            .setCustomId(`alter_edit_groups_modal_${sessionId}`)
            .setTitle('Edit Group Memberships');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('group_names')
                .setLabel('Groups (comma-separated indexable names)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(currentGroupNames.join(', '))
                .setPlaceholder('Enter group names to assign this alter to')
                .setRequired(false)
                .setMaxLength(1000)
        ));
        return await interaction.showModal(modal);
    }

    // Edit → Edit States (modal to add/remove state connections)
    if (customId.startsWith('alter_edit_states_')) {
        const alter = await Alter.findById(session.alterId);
        const connectedStates = await State.find({ _id: { $in: alter.states?.map(s => s.connected_id) || [] } });
        const stateNames = connectedStates.map(s => s.name?.indexable).filter(Boolean);

        const modal = new ModalBuilder()
            .setCustomId(`alter_edit_states_modal_${sessionId}`)
            .setTitle('Edit State Connections');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('state_names')
                .setLabel('States (comma-separated indexable names)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(stateNames.join(', '))
                .setPlaceholder('Enter state names to connect this alter to')
                .setRequired(false)
                .setMaxLength(1000)
        ));
        return await interaction.showModal(modal);
    }
}

// ==== SELECT MENU HANDLER ====

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

    // Privacy toggle select
    if (interaction.customId.startsWith('alter_privacy_toggle_select_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!alter.setting) alter.setting = {};
        if (!alter.setting.privacy) alter.setting.privacy = [];

        let privacy = alter.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            alter.setting.privacy.push(privacy);
        }

        // Toggle hidden
        privacy.settings.hidden = privacy.settings.hidden === false ? true : false;
        await alter.save();

        // Return to privacy settings
        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure who can see what information about this alter.');

        if (system.privacyBuckets?.length > 0) {
            for (const bucket of system.privacyBuckets) {
                const p = alter.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (visible)';
                if (p?.settings?.hidden === false) status = '❌ Hidden';
                else if (p?.settings?.hidden === true) status = '✅ Visible';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`alter_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy toggle ping select
    if (interaction.customId.startsWith('alter_privacy_toggle_ping_select_')) {
        const alter = await Alter.findById(session.alterId);
        const system = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!alter.setting) alter.setting = {};
        if (!alter.setting.privacy) alter.setting.privacy = [];

        let privacy = alter.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            alter.setting.privacy.push(privacy);
        }

        // Toggle allowPing
        privacy.settings.allowPing = privacy.settings.allowPing === false ? true : false;
        await alter.save();

        // Return to privacy settings
        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(alter)}`)
            .setDescription('Configure who can see what information about this alter.');

        if (system.privacyBuckets?.length > 0) {
            for (const bucket of system.privacyBuckets) {
                const p = alter.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (pings allowed)';
                if (p?.settings?.allowPing === false) status = '🔕 Pings disabled';
                else if (p?.settings?.allowPing === true) status = '🔔 Pings allowed';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`alter_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`alter_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`alter_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    const alter = await Alter.findById(session.alterId);
    const value = interaction.values[0];

    const modalBuilders = {
        card_info: () => {
            const modal = new ModalBuilder().setCustomId(`alter_edit_card_modal_${sessionId}`).setTitle('Edit Card Info');
            const target = utils.getEditTarget(alter, session);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('display_name').setLabel('Display Name').setStyle(TextInputStyle.Short).setValue(target?.name?.display || alter.name?.display || '').setRequired(false).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(target?.description || alter.description || '').setRequired(false).setMaxLength(2000)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color (hex code)').setStyle(TextInputStyle.Short).setValue(target?.color || alter.color || '').setRequired(false).setMaxLength(7))
            );
            return modal;
        },
        personal_info: () => {
            const modal = new ModalBuilder().setCustomId(`alter_edit_personal_modal_${sessionId}`).setTitle('Edit Personal Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pronouns').setLabel('Pronouns (comma-separated)').setStyle(TextInputStyle.Short).setValue(alter.pronouns?.join(', ') || '').setRequired(false).setMaxLength(200)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('birthday').setLabel('Birthday (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setValue(alter.birthday ? new Date(alter.birthday).toISOString().split('T')[0] : '').setRequired(false).setMaxLength(10)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aliases').setLabel('Aliases (comma-separated)').setStyle(TextInputStyle.Paragraph).setValue(alter.name?.aliases?.join(', ') || '').setRequired(false).setMaxLength(500))
            );
            return modal;
        },
        proxy_info: () => {
            const modal = new ModalBuilder().setCustomId(`alter_edit_proxy_modal_${sessionId}`).setTitle('Edit Proxy Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxies').setLabel('Proxies (one per line, use "text" as placeholder)').setStyle(TextInputStyle.Paragraph).setValue(alter.proxy?.join('\n') || '').setPlaceholder('a:text\ntext -a\n-alter text').setRequired(false).setMaxLength(500)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('signoff').setLabel('Sign-offs (one per line, emojis recommended)').setStyle(TextInputStyle.Paragraph).setValue(alter.signoff || '').setPlaceholder('✨\n💫').setRequired(false).setMaxLength(200))
            );
            return modal;
        },
        image_info: () => {
            const modal = new ModalBuilder().setCustomId(`alter_edit_image_modal_${sessionId}`).setTitle('Edit Image Info');
            const target = utils.getEditTarget(alter, session);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avatar_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setValue(target?.avatar?.url || target?.image?.avatar?.url || alter.avatar?.url || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner_url').setLabel('Banner URL').setStyle(TextInputStyle.Short).setValue(target?.image?.banner?.url || alter.discord?.image?.banner?.url || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxy_avatar_url').setLabel('Proxy Avatar URL').setStyle(TextInputStyle.Short).setValue(target?.image?.proxyAvatar?.url || alter.discord?.image?.proxyAvatar?.url || '').setRequired(false))
            );
            return modal;
        },
        caution_info: () => {
            const modal = new ModalBuilder().setCustomId(`alter_edit_caution_modal_${sessionId}`).setTitle('Edit Caution Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caution_type').setLabel('Caution Type').setStyle(TextInputStyle.Short).setValue(alter.caution?.c_type || '').setRequired(false).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caution_detail').setLabel('Caution Details').setStyle(TextInputStyle.Paragraph).setValue(alter.caution?.detail || '').setRequired(false).setMaxLength(1000)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trigger_names').setLabel('Trigger Names (comma-separated)').setStyle(TextInputStyle.Short).setValue(alter.caution?.triggers?.map(t => t.name).join(', ') || '').setRequired(false).setMaxLength(500))
            );
            return modal;
        }
    };

    await interaction.showModal(modalBuilders[value]());
}

// ==== MODAL SUBMIT HANDLER ====

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please start again.', ephemeral: true });

    const alter = await Alter.findById(session.alterId);

    // Condition change modal
    if (interaction.customId.startsWith('alter_condition_modal_')) {
        const conditionName = interaction.fields.getTextInputValue('condition_name');
        alter.condition = conditionName;
        await alter.save();

        await utils.ensureConditionExists(await System.findById(session.systemId), 'alters', conditionName);

        utils.deleteSession(sessionId);
        return await interaction.update({ content: `✅ **${utils.getDisplayName(alter)}** condition changed to "${conditionName}".`, embeds: [], components: [] });
    }

    // Card info modal
    if (interaction.customId.startsWith('alter_edit_card_modal_')) {
        const displayName = interaction.fields.getTextInputValue('display_name');
        const description = interaction.fields.getTextInputValue('description');
        const color = interaction.fields.getTextInputValue('color');

        utils.updateEntityProperty(alter, session, 'name.display', displayName);
        utils.updateEntityProperty(alter, session, 'description', description);
        utils.updateEntityProperty(alter, session, 'color', color);
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
    }

    // Personal info modal
    if (interaction.customId.startsWith('alter_edit_personal_modal_')) {
        const pronouns = interaction.fields.getTextInputValue('pronouns');
        const birthday = interaction.fields.getTextInputValue('birthday');
        const aliases = interaction.fields.getTextInputValue('aliases');

        if (pronouns) alter.pronouns = utils.parseCommaSeparated(pronouns);
        if (birthday) {
            const date = new Date(birthday);
            if (!isNaN(date.getTime())) alter.birthday = date;
        }
        if (aliases) {
            if (!alter.name) alter.name = {};
            alter.name.aliases = utils.parseCommaSeparated(aliases);
        }
        await alter.save();
    }

    // Proxy info modal
    if (interaction.customId.startsWith('alter_edit_proxy_modal_')) {
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
                alter._id.toString(),
                'alter'
            );

            if (duplicates.length > 0) {
                const dupList = duplicates.map(d => `\`${d.proxy}\` (used by ${d.owner})`).join('\n');

                // Still save valid proxies
                alter.proxy = valid;
                if (signoff !== undefined) alter.signoff = signoff || undefined;
                await alter.save();

                // Show warning about duplicates
                session.id = sessionId;
                const { embed, components } = buildEditInterface(alter, session);
                return await interaction.update({
                    content: `⚠️ Some proxies were already in use and were skipped:\n${dupList}\n\nValid proxies were saved.`,
                    embeds: [embed],
                    components
                });
            }
            alter.proxy = valid;
        } else {
            alter.proxy = [];
        }

        if (signoff !== undefined) alter.signoff = signoff || undefined;
        await alter.save();
    }

    // Image info modal
    if (interaction.customId.startsWith('alter_edit_image_modal_')) {
        const avatarUrl = interaction.fields.getTextInputValue('avatar_url');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url');
        const proxyAvatarUrl = interaction.fields.getTextInputValue('proxy_avatar_url');

        if (session.mode === 'mask') {
            if (!alter.mask) alter.mask = {};
            if (avatarUrl) alter.mask.avatar = { url: avatarUrl };
            if (!alter.mask.discord) alter.mask.discord = { image: {} };
            if (bannerUrl) alter.mask.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) alter.mask.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else if (!session.syncWithDiscord) {
            if (!alter.discord) alter.discord = { image: {} };
            if (!alter.discord.image) alter.discord.image = {};
            if (avatarUrl) alter.discord.image.avatar = { url: avatarUrl };
            if (bannerUrl) alter.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) alter.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else {
            if (avatarUrl) alter.avatar = { url: avatarUrl };
            if (!alter.discord) alter.discord = { image: {} };
            if (!alter.discord.image) alter.discord.image = {};
            if (bannerUrl) alter.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) alter.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        }
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
    }

    // Caution info modal
    if (interaction.customId.startsWith('alter_edit_caution_modal_')) {
        if (!alter.caution) alter.caution = {};
        alter.caution.c_type = interaction.fields.getTextInputValue('caution_type') || undefined;
        alter.caution.detail = interaction.fields.getTextInputValue('caution_detail') || undefined;
        const triggerNames = interaction.fields.getTextInputValue('trigger_names');
        if (triggerNames) {
            alter.caution.triggers = utils.parseCommaSeparated(triggerNames).map(name => ({ name }));
        }
        await alter.save();
    }

    // Settings modals
    if (interaction.customId.startsWith('alter_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');
        if (!alter.name) alter.name = {};
        alter.name.closedNameDisplay = closedName || null;
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return await interaction.update({ content: `✅ Closed name display updated to: ${closedName || '*Not set*'}`, embeds: [], components: [] });
    }

    // Edit groups modal
    if (interaction.customId.startsWith('alter_edit_groups_modal_')) {
        const groupNamesInput = interaction.fields.getTextInputValue('group_names');
        const groupNames = utils.parseCommaSeparated(groupNamesInput);

        const system = await System.findById(session.systemId);
        const allGroups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });

        const matchingGroupIds = [];
        for (const name of groupNames) {
            const group = allGroups.find(g => g.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (group) matchingGroupIds.push(group._id.toString());
        }

        // Calculate diff for reverse sync (group.alterIDs)
        const oldGroupIds = alter.groupsIDs || [];
        const removedGroupIds = oldGroupIds.filter(id => !matchingGroupIds.includes(id));
        const addedGroupIds = matchingGroupIds.filter(id => !oldGroupIds.includes(id));

        alter.groupsIDs = matchingGroupIds;
        await alter.save();

        // Sync reverse: group.alterIDs
        if (removedGroupIds.length > 0) {
            await Group.updateMany({ _id: { $in: removedGroupIds } }, { $pull: { alterIDs: alter._id.toString() } });
        }
        if (addedGroupIds.length > 0) {
            await Group.updateMany({ _id: { $in: addedGroupIds } }, { $addToSet: { alterIDs: alter._id.toString() } });
        }
    }

    // Edit states modal
    if (interaction.customId.startsWith('alter_edit_states_modal_')) {
        const stateNamesInput = interaction.fields.getTextInputValue('state_names');
        const stateNames = utils.parseCommaSeparated(stateNamesInput);

        const system = await System.findById(session.systemId);
        const allStates = await State.find({ _id: { $in: system.states?.IDs || [] } });

        // Build the states array with connected_id references
        const newStates = [];
        for (const name of stateNames) {
            const state = allStates.find(s => s.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (state) {
                const existing = alter.states?.find(s => s.connected_id === state._id.toString());
                if (existing) {
                    newStates.push(existing);
                } else {
                    newStates.push({ connected_id: state._id.toString(), name: { indexable: state.name?.indexable, display: state.name?.display } });
                }
            }
        }

        // Calculate diff for reverse sync (state.alters)
        const oldStateIds = (alter.states || []).map(s => s.connected_id);
        const newStateIds = newStates.map(s => s.connected_id);
        const removedStateIds = oldStateIds.filter(id => !newStateIds.includes(id));
        const addedStateIds = newStateIds.filter(id => !oldStateIds.includes(id));

        alter.states = newStates;
        await alter.save();

        // Sync reverse: state.alters
        if (removedStateIds.length > 0) {
            await State.updateMany({ _id: { $in: removedStateIds } }, { $pull: { alters: alter._id.toString() } });
        }
        if (addedStateIds.length > 0) {
            await State.updateMany({ _id: { $in: addedStateIds } }, { $addToSet: { alters: alter._id.toString() } });
        }
    }

    // Return to edit interface for edit modals
    session.id = sessionId;
    const { embed, components } = buildEditInterface(alter, session);
    await interaction.update({ embeds: [embed], components });
}