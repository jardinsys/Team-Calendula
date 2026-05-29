// (/group) - Systemiser Group Management Command

// (/group menu)
// (/group showlist ) (click button to show full in ephemeral)
// (/group showlist user:[@user] userID:[string])

// (/group show user:[user]userID:[string] group_name:[string]) (click button to show all info in ephemeral)
// (/group show group_name:[string])

// (OLD)
// (/group new group_name:[string])
// (/group delete group_name:[string])

// (/group group_name:[string] edit (have the select menu of what to edit (card info, personal info, proxy info, image info, caution info ) and have a buttons to (enter mask mode, open group settings, edit groups, edit states))
// (/group group_name:[string] settings

// (NEW)
// (/group manage action:(new/edit/add/remove/settings) group_name:[string]) (delete will be in settings)

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

const Group = require('../../../schemas/group');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');

// Import shared utilities
const utils = require('../../functions/bot_utils');
const proxyMessageHandler = require('../proxy-message');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('group')
        .setDescription('Manage your groups')

        // VIEW subcommand
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View group information')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to view')
                .setRequired(true)
                .addChoices(
                    { name: 'List - Show all groups', value: 'list' },
                    { name: 'Show - View specific group details', value: 'show' }
                ))
            .addStringOption(opt => opt
                .setName('group_name')
                .setDescription('Group name (required for "show")')
                .setRequired(false))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('View another user\'s groups')
                .setRequired(false))
            .addBooleanOption(opt => opt
                .setName('show_all')
                .setDescription('Show hidden groups (list only)')
                .setRequired(false)))

        // MANAGE subcommand
        .addSubcommand(sub => sub
            .setName('manage')
            .setDescription('Create, edit, and delete groups')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to do')
                .setRequired(true)
                .addChoices(
                    { name: 'New - Create new group', value: 'new' },
                    { name: 'Edit - Modify existing group', value: 'edit' },
                    { name: 'Settings - Configure group settings', value: 'settings' },
                    { name: 'Delete - Remove group permanently', value: 'delete' }
                ))
            .addStringOption(opt => opt
                .setName('group_name')
                .setDescription('Group name (required for edit/delete)')
                .setRequired(false)))

/*        // SETTINGS subcommand
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Configure group settings')
            .addStringOption(opt => opt
                .setName('group_name')
                .setDescription('Group name')
                .setRequired(true))),*/,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'group');
        if (!system && subcommand !== 'view') return await interaction.reply({ content: '❌ You need to set up a system first. Use `/system` to get started.', ephemeral: true });

        const action = interaction.options.getString('action');
        switch (action) {
            case 'list': return await handleShowList(interaction, user, system); break;
            case 'show': return await handleShow(interaction, user, system); break;
            case 'new': return await handleNew(interaction, user, system); break;
            case 'edit': return await handleEdit(interaction, user, system); break;
            case 'settings': return await handleSettings(interaction, user, system); break;
            case 'delete': return await handleDelete(interaction, user, system); break;
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ==== EMBED BUILDERS ====

function buildGroupListEmbed(groups, page, system, showFullList) {
    const pageGroups = utils.getPageItems(groups, page);
    const totalPages = utils.getTotalPages(groups.length);

    const embed = new EmbedBuilder()
        .setTitle(`${utils.getDisplayName(system)}'s Groups`)
        .setDescription(showFullList ? '📋 Showing full list (including hidden)' : '📋 Group List')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${groups.length} group(s)` });

    // Use system color if available
    const embedColor = utils.getSystemEmbedColor(system);
    if (embedColor) embed.setColor(embedColor);

    if (pageGroups.length === 0) {
        embed.addFields({ name: 'No groups', value: 'No groups to display.' });
    } else {
        const groupsByType = {};
        for (const group of pageGroups) {
            const typeName = group.type?.name || 'Other';
            if (!groupsByType[typeName]) groupsByType[typeName] = [];
            groupsByType[typeName].push(group);
        }

        for (const [typeName, typeGroups] of Object.entries(groupsByType)) {
            const groupList = typeGroups.map(g => {
                const name = g.name?.indexable || 'Unknown';
                const proxies = utils.formatProxies(g.proxy);
                return `**${name}** - ${proxies}`;
            }).join('\n');
            embed.addFields({ name: `📁 ${typeName}`, value: groupList, inline: false });
        }
    }

    return embed;
}

async function buildGroupCard(group, system, privacyBucket, closedCharAllowed = true, guildId = null) {
    const embed = new EmbedBuilder();

    const session = { mode: null, syncWithDiscord: group.syncWithApps?.discord, serverId: guildId };

    // Color priority: group.color > system.color > none
    const color = utils.getEntityEmbedColor(group, system);
    const description = utils.getDiscordOrDefault(group, 'description');
    const displayName = closedCharAllowed
        ? (group.name?.display || group.name?.indexable)
        : (group.name?.closedNameDisplay || group.name?.display || group.name?.indexable);

    const proxyAvatar = utils.resolveProxyAvatarUrl(group, session);
    embed.setAuthor({
        name: `${group.name?.indexable || 'Unknown'} (from ${utils.getDisplayName(system, closedCharAllowed)})`,
        iconURL: proxyAvatar || undefined
    });

    embed.setTitle(displayName || 'Unknown Group');
    if (color) embed.setColor(color);
    if (description) embed.setDescription(description);

    // Count members
    const alterCount = await Alter.countDocuments({ groupsIDs: group._id.toString() });
    const stateCount = await State.countDocuments({ groupIDs: group._id.toString() });

    let identInfo = `**Alters:** ${alterCount}\n**States:** ${stateCount}\n`;
    if (group.signoff) identInfo += `**Sign-off:** ${group.signoff}\n`;
    if (group.proxy?.length > 0) identInfo += `**Proxies:** ${utils.formatProxies(group.proxy)}\n`;
    if (group.name?.aliases?.length > 0) identInfo += `**Aliases:** ${group.name.aliases.join(', ')}\n`;
    if (group.type?.name) identInfo += `**Type:** ${group.type.name}\n`;
    if (group.type?.canFront) identInfo += `**Can Front:** ${group.type.canFront}\n`;

    embed.addFields({ name: '🏷️ Identification', value: identInfo.trim(), inline: false });

    if (group.caution && (group.caution.c_type || group.caution.detail || group.caution.triggers?.length)) {
        let cautionInfo = '';
        if (group.caution.c_type) cautionInfo += `**Type:** ${group.caution.c_type}\n`;
        if (group.caution.detail) cautionInfo += `**Details:** ${group.caution.detail}\n`;
        if (group.caution.triggers?.length) 
            cautionInfo += `**Triggers:** ${group.caution.triggers.map(t => t.name).filter(Boolean).join(', ')}\n`;
        if (cautionInfo) embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
    }

    const avatar = utils.resolveAvatarUrl(group, session);
    if (avatar) embed.setThumbnail(avatar);

    const banner = utils.resolveBannerUrl(group, session);
    if (banner) embed.setImage(banner);

    return embed;
}

function buildEditInterface(group, session, system = null) {
    const embed = new EmbedBuilder()
        .setTitle(`Editing: ${utils.getDisplayName(group)}`)
        .setDescription(session.mode
            ? `Currently in **${session.mode.toUpperCase()} MODE**\n\nSelect what to edit.`
            : 'Select what you would like to edit from the dropdown menu below.'
        );

    // Color priority: group.color > system.color > none
    const color = utils.getEntityEmbedColor(group, system);
    if (color) embed.setColor(color);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`group_edit_select_${session.id}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Card Info').setValue('card_info').setEmoji('🎴'),
            new StringSelectMenuOptionBuilder().setLabel('Type Info').setValue('type_info').setEmoji('📁'),
            new StringSelectMenuOptionBuilder().setLabel('Aliases').setValue('aliases_info').setEmoji('📝'),
            new StringSelectMenuOptionBuilder().setLabel('Proxy Info').setValue('proxy_info').setEmoji('💬'),
            new StringSelectMenuOptionBuilder().setLabel('Image Info').setValue('image_info').setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder().setLabel('Caution Info').setValue('caution_info').setEmoji('⚠️'),
            new StringSelectMenuOptionBuilder().setLabel('Members').setValue('members_info').setEmoji('👥')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const modeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`group_edit_mode_mask_${session.id}`)
            .setLabel(session.mode === 'mask' ? 'Exit Mask Mode' : 'Enter Mask Mode')
            .setStyle(session.mode === 'mask' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`group_edit_mode_server_${session.id}`)
            .setLabel(session.mode === 'server' ? 'Exit Server Mode' : 'Enter Server Mode')
            .setStyle(session.mode === 'server' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🏠')
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_edit_settings_${session.id}`).setLabel('Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId(`group_edit_done_${session.id}`).setLabel('Done').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    const uploadRow = session.uploadMode
        ? new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`group_upload_select_${session.id}`)
                .setPlaceholder('Choose media type to upload...')
                .addOptions(utils.buildUploadOptions(session)),
            new ButtonBuilder().setCustomId(`group_upload_back_${session.id}`).setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        )
        : new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_upload_media_${session.id}`).setLabel('Upload Media').setStyle(ButtonStyle.Secondary).setEmoji('📎')
        );

    return { embed, components: [selectRow, modeRow, actionRow, uploadRow] };
}

// ==== COMMAND HANDLERS ====

/*// (Dead code — menu subcommand is commented out, kept for reference)
async function handleMenu(interaction, user, system) {
    const embed = new EmbedBuilder()
        .setTitle('👥 Group Management')
        .setDescription('Select a button to start managing your groups.');

    const menuColor = utils.getSystemEmbedColor(system);
    if (menuColor) embed.setColor(menuColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('group_menu_showlist').setLabel('Show List').setStyle(ButtonStyle.Primary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('group_menu_select').setLabel('Select Group').setStyle(ButtonStyle.Secondary).setEmoji('🔍')
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}*/

async function handleShowList(interaction, currentUser, currentSystem) {
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

        if (!otherUser?.systemID) return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });

        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) 
            return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) return await interaction.reply({ content: '❌ No system found.', ephemeral: true });

    const groups = await Group.find({ _id: { $in: targetSystem.groups?.IDs || [] } });
    if (groups.length === 0) return await interaction.reply({ content: '📭 No groups found.', ephemeral: true });

    const visibleGroups = groups.filter(g => utils.shouldShowEntity(g, privacyBucket, isOwner, false));

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'showlist',
        groups: visibleGroups,
        allGroups: groups,
        page: 0,
        showFullList: false,
        isOwner,
        systemId: targetSystem._id
    });

    const embed = buildGroupListEmbed(visibleGroups, 0, targetSystem, false);
    const buttons = utils.buildListButtons(visibleGroups.length, 0, isOwner, false, sessionId, 'group');

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function handleShow(interaction, currentUser, currentSystem) {
    const groupName = interaction.options.getString('group_name');
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

        if (!otherUser?.systemID) return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) return await interaction.reply({ content: '❌ No system found.', ephemeral: true });

    const group = await utils.findGroupByName(groupName, targetSystem);
    if (!group || (!isOwner && !utils.shouldShowEntity(group, privacyBucket, isOwner))) 
        return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildGroupCard(group, targetSystem, privacyBucket, closedCharAllowed, interaction.guildId);

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'show', groupId: group._id, systemId: targetSystem._id, isOwner });

    const buttons = isOwner ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_show_full_${sessionId}`).setLabel('Show All Info').setStyle(ButtonStyle.Primary).setEmoji('📄')
    )] : [];

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function handleNew(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');

    if (!utils.isValidIndexableName(groupName)) return await interaction.reply({ content: '❌ Invalid name format. Use only letters, numbers, hyphens, and underscores.', ephemeral: true });
    if (await utils.findGroupByName(groupName, system)) return await interaction.reply({ content: '❌ A group with this name already exists.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'new', groupName: groupName.toLowerCase(), systemId: system._id, userId: user._id });

    const { embed, buttons } = utils.buildSyncConfirmation('group', groupName, sessionId, 'new');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleEdit(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');
    const group = await utils.findGroupByName(groupName, system);

    if (!group) return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });
    if (group.systemID !== system._id.toString()) return await interaction.reply({ content: '❌ This group does not belong to your system.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'edit', groupId: group._id, systemId: system._id, mode: null, syncWithDiscord: group.syncWithApps?.discord || false });

    // Go straight to edit interface (sync is managed in settings)
    const { embed, components } = buildEditInterface(group, { id: sessionId }, system);
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleDelete(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');
    const group = await utils.findGroupByName(groupName, system);

    if (!group) return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'delete', groupId: group._id, systemId: system._id });

    const alterCount = await Alter.countDocuments({ groupsIDs: group._id.toString() });
    const stateCount = await State.countDocuments({ groupIDs: group._id.toString() });

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Delete Group Confirmation')
        .setDescription(`Are you sure you want to delete **${utils.getDisplayName(group)}**?\n\nThis group contains **${alterCount}** alter(s) and **${stateCount}** state(s).\nMembers will be removed from this group but not deleted.`)
        .setFooter({ text: 'This action cannot be undone!' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_delete_confirm_${sessionId}`).setLabel('Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`group_delete_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleSettings(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');
    const group = await utils.findGroupByName(groupName, system);

    if (!group) return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'settings', groupId: group._id, systemId: system._id });

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
        .setDescription('Configure settings for this group.')
        .addFields(
            { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
            { name: 'Default Status', value: group.setting?.default_status || '*Not set*', inline: true },
            { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
            { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true },
            { name: 'Allow Pings', value: group.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Sync with Discord', value: group.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
        );

    const settingsColor = utils.getEntityEmbedColor(group, system);
    if (settingsColor) embed.setColor(settingsColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`group_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`group_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId(`group_settings_allowping_${sessionId}`).setLabel(group.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(group.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const syncRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`group_settings_sync_${sessionId}`)
            .setLabel(group.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
            .setStyle(group.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(group.syncWithApps?.discord ? '✅' : '🔄')
    );

    await interaction.reply({ embeds: [embed], components: [buttons, syncRow], ephemeral: true });
}

// ==== BUTTON HANDLER ====

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('new_user_'))  return await utils.handleNewUserButton(interaction, 'group');

    // (Removed: group_menu_showlist mock interaction — menu subcommand is commented out, dead code)

    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    // Fetch system for color and member operations
    const system = await System.findById(session.systemId);

    // List navigation
    if (customId.startsWith('group_list_prev_')) session.page = Math.max(0, session.page - 1);
    if (customId.startsWith('group_list_next_')) {
        const groups = session.showFullList ? session.allGroups : session.groups;
        session.page = Math.min(utils.getTotalPages(groups.length) - 1, session.page + 1);
    }
    if (customId.startsWith('group_list_toggle_')) { session.showFullList = !session.showFullList; session.page = 0; }

    if (customId.startsWith('group_list_')) {
        const groups = session.showFullList ? session.allGroups : session.groups;
        return await interaction.update({
            embeds: [buildGroupListEmbed(groups, session.page, system, session.showFullList)],
            components: utils.buildListButtons(groups.length, session.page, session.isOwner, session.showFullList, sessionId, 'group')
        });
    }

    // Show full
    if (customId.startsWith('group_show_full_')) {
        const group = await Group.findById(session.groupId);
        const embed = await buildGroupCard(group, system, null, true, interaction.guildId);
        if (group.metadata?.addedAt) embed.addFields({ name: '📊 Metadata', value: `**Added:** ${utils.formatDate(group.metadata.addedAt)}`, inline: false });
        return await interaction.update({ embeds: [embed], components: [] });
    }

    // Sync buttons
    if (customId.startsWith('group_new_sync_') || customId.startsWith('group_edit_sync_')) {
        session.syncWithDiscord = customId.includes('_yes_');
        session.id = sessionId;

        if (customId.startsWith('group_new_sync_')) {
            const newGroup = new Group({
                systemID: session.systemId,
                createdAt: new Date(),
                syncWithApps: { discord: session.syncWithDiscord },
                name: { indexable: session.groupName, display: session.groupName },
                metadata: { addedAt: new Date() }
            });
            await newGroup.save();
            await System.findByIdAndUpdate(session.systemId, { $push: { 'groups.IDs': newGroup._id.toString() } });
            session.groupId = newGroup._id;
            session.type = 'edit';
        } else {
            const group = await Group.findById(session.groupId);
            group.syncWithApps = { discord: session.syncWithDiscord };
            await group.save();
        }

        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Mode toggles
    if (customId.startsWith('group_edit_mode_mask_')) {
        session.mode = session.mode === 'mask' ? null : 'mask';
        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    if (customId.startsWith('group_edit_mode_server_')) {
        const group = await Group.findById(session.groupId);
        if (session.mode === 'server') {
            session.mode = null;
            delete session.serverId;
        } else {
            session.mode = 'server';
            session.serverId = interaction.guildId;
            utils.ensureServerEntry(group, interaction.guildId, interaction.guild?.name);
        }
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Done
    if (customId.startsWith('group_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Editing complete!', embeds: [], components: [] });
    }

    // Upload Media → show select menu
    if (customId.startsWith('group_upload_media_')) {
        session.uploadMode = true;
        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload Back → return to button
    if (customId.startsWith('group_upload_back_')) {
        session.uploadMode = false;
        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Upload type selected → prompt for attachment
    if (customId.startsWith('group_upload_select_')) {
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
            const group = await Group.findById(session.groupId);
            const result = await utils.handleAttachmentUpload(attachment, config.fieldLabel, 'Group', interaction.user.id);

            if (result.success) {
                if (config.path === 'mask') {
                    const oldMedia = group.mask?.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key);
                    if (!group.mask) group.mask = {};
                    group.mask.avatar = result.media;
                } else if (config.path === 'mask_discord') {
                    if (!group.mask) group.mask = {};
                    if (!group.mask.discord) group.mask.discord = { image: {} };
                    if (!group.mask.discord.image) group.mask.discord.image = {};
                    const oldMedia = group.mask.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key);
                    group.mask.discord.image[config.mediaType] = result.media;
                } else if (config.path === 'server') {
                    const serverEntry = utils.ensureServerEntry(group, session.serverId, interaction.guild?.name);
                    const oldMedia = serverEntry[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key);
                    serverEntry[config.mediaType] = result.media;
                } else if (config.path === 'primary') {
                    const oldMedia = group.avatar;
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key);
                    group.avatar = result.media;
                } else {
                    if (!group.discord) group.discord = {};
                    if (!group.discord.image) group.discord.image = {};
                    const oldMedia = group.discord.image[config.mediaType];
                    if (oldMedia?.r2Key) await utils.deleteFromR2(oldMedia.r2Key);
                    group.discord.image[config.mediaType] = result.media;
                }

                await group.save();
                await proxyMessageHandler.invalidateDisplayCache(group._id);
                const { embed, components } = buildEditInterface(group, session, system);
                return await interaction.editReply({ content: result.message, embeds: [embed], components });
            } else {
                return await interaction.editReply({ content: result.message });
            }
        } catch (err) {
            return await interaction.editReply({ content: '⏰ Upload timed out. Please try again.' });
        }
    }

    // Delete
    if (customId.startsWith('group_delete_confirm_')) {
        await Alter.updateMany({ groupsIDs: session.groupId.toString() }, { $pull: { groupsIDs: session.groupId.toString() } });
        await State.updateMany({ groupIDs: session.groupId.toString() }, { $pull: { groupIDs: session.groupId.toString() } });
        system.groups.IDs = system.groups.IDs.filter(id => id !== session.groupId.toString());
        await system.save();
        await Group.findByIdAndDelete(session.groupId);
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Group deleted.', embeds: [], components: [] });
    }

    if (customId.startsWith('group_delete_cancel_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '❌ Cancelled.', embeds: [], components: [] });
    }

    // Settings
    if (customId.startsWith('group_settings_closedname_')) {
        const group = await Group.findById(session.groupId);
        const modal = new ModalBuilder().setCustomId(`group_settings_closedname_modal_${sessionId}`).setTitle('Closed Name');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('closed_name').setLabel('Closed Name Display').setStyle(TextInputStyle.Short).setValue(group.name?.closedNameDisplay || '').setRequired(false)
        ));
        return await interaction.showModal(modal);
    }

    // Edit → Settings transition (from buildEditInterface action row)
    if (customId.startsWith('group_edit_settings_')) {
        const group = await Group.findById(session.groupId);
        session.type = 'settings';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure settings for this group.')
            .addFields(
                { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: group.setting?.default_status || '*Not set*', inline: true },
                { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
                { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true }
            );

        const color = utils.getEntityEmbedColor(group, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`group_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`group_settings_back_${sessionId}`).setLabel('Back to Edit').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Settings → Privacy Settings
    if (customId.startsWith('group_settings_privacy_')) {
        const group = await Group.findById(session.groupId);
        const sys = await System.findById(session.systemId);

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure who can see what information about this group.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const privacy = group.setting?.privacy?.find(p => p.bucket === bucket.name);
                let status = 'Default (visible)';
                if (privacy?.settings?.hidden === false) status = '❌ Hidden';
                else if (privacy?.settings?.hidden === true) status = '✅ Visible';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        } else {
            embed.addFields({ name: 'No buckets', value: 'No privacy buckets configured.', inline: false });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`group_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`group_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy → Toggle Hidden
    if (customId.startsWith('group_privacy_toggle_hidden_')) {
        const group = await Group.findById(session.groupId);
        const sys = await System.findById(session.systemId);

        if (!sys.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const bucketOptions = sys.privacyBuckets.map(b => {
            const privacy = group.setting?.privacy?.find(p => p.bucket === b.name);
            const isHidden = privacy?.settings?.hidden === false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${isHidden ? 'Hidden' : 'Visible'})`)
                .setValue(b.name)
                .setEmoji(isHidden ? '❌' : '✅');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`group_privacy_toggle_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle hidden...')
            .addOptions(bucketOptions);

        return await interaction.update({ content: 'Select a bucket to toggle hidden/visible:', embeds: [], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }

    // Privacy → Toggle Allow Pings
    if (customId.startsWith('group_privacy_toggle_ping_')) {
        const group = await Group.findById(session.groupId);
        const sys = await System.findById(session.systemId);

        if (!sys.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const bucketOptions = sys.privacyBuckets.map(b => {
            const privacy = group.setting?.privacy?.find(p => p.bucket === b.name);
            const pingAllowed = privacy?.settings?.allowPing !== false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${pingAllowed ? 'Pings ON' : 'Pings OFF'})`)
                .setValue(b.name)
                .setEmoji(pingAllowed ? '🔔' : '🔕');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`group_privacy_toggle_ping_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle pings...')
            .addOptions(bucketOptions);

        return await interaction.update({ content: 'Select a bucket to toggle allow pings:', embeds: [], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }

    // Privacy → Back to Settings
    if (customId.startsWith('group_privacy_back_')) {
        const group = await Group.findById(session.groupId);
        session.type = 'settings';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure settings for this group.')
            .addFields(
                { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: group.setting?.default_status || '*Not set*', inline: true },
                { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
                { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true },
                { name: 'Sync with Discord', value: group.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(group, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`group_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭')
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`group_settings_sync_${sessionId}`)
                .setLabel(group.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(group.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(group.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Edit Default Status
    if (customId.startsWith('group_settings_status_')) {
        const group = await Group.findById(session.groupId);

        const modal = new ModalBuilder()
            .setCustomId(`group_settings_status_modal_${sessionId}`)
            .setTitle('Edit Default Status');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('default_status')
                    .setLabel('Default Status')
                    .setStyle(TextInputStyle.Short)
                    .setValue(group.setting?.default_status || '')
                    .setRequired(false)
                    .setMaxLength(100)
            )
        );

        return await interaction.showModal(modal);
    }

    // Mask settings (transition to edit interface with mask mode active)
    if (customId.startsWith('group_settings_mask_')) {
        session.type = 'edit';
        session.mode = 'mask';
        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }

    // Settings → Toggle Sync with Discord
    if (customId.startsWith('group_settings_sync_')) {
        const group = await Group.findById(session.groupId);
        group.syncWithApps = { discord: !group.syncWithApps?.discord };
        await group.save();

        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure settings for this group.')
            .addFields(
                { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: group.setting?.default_status || '*Not set*', inline: true },
                { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
                { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true },
                { name: 'Allow Pings', value: group.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Sync with Discord', value: group.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(group, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`group_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`group_settings_allowping_${sessionId}`).setLabel(group.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(group.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`group_settings_sync_${sessionId}`)
                .setLabel(group.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(group.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(group.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Toggle Allow Pings
    if (customId.startsWith('group_settings_allowping_')) {
        const group = await Group.findById(session.groupId);
        if (!group.setting) group.setting = {};
        group.setting.allowPing = group.setting.allowPing === false ? true : (group.setting.allowPing === undefined ? false : !group.setting.allowPing);
        await group.save();

        session.type = 'settings';
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure settings for this group.')
            .addFields(
                { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
                { name: 'Default Status', value: group.setting?.default_status || '*Not set*', inline: true },
                { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
                { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true },
                { name: 'Allow Pings', value: group.setting?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Sync with Discord', value: group.syncWithApps?.discord ? '✅ Yes' : '🔄 No', inline: true }
            );

        const color = utils.getEntityEmbedColor(group, system);
        if (color) embed.setColor(color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`group_settings_status_${sessionId}`).setLabel('Edit Default Status').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`group_settings_mask_${sessionId}`).setLabel('Mask Settings').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
            new ButtonBuilder().setCustomId(`group_settings_allowping_${sessionId}`).setLabel(group.setting?.allowPing !== false ? 'Pings: ON' : 'Pings: OFF').setStyle(group.setting?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const syncRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`group_settings_sync_${sessionId}`)
                .setLabel(group.syncWithApps?.discord ? 'Synced with Discord' : 'Not Synced')
                .setStyle(group.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji(group.syncWithApps?.discord ? '✅' : '🔄')
        );

        return await interaction.update({ embeds: [embed], components: [buttons, syncRow] });
    }

    // Settings → Back to Edit
    if (customId.startsWith('group_settings_back_')) {
        const group = await Group.findById(session.groupId);
        session.type = 'edit';
        session.mode = null;
        const { embed, components } = buildEditInterface(group, session, system);
        return await interaction.update({ embeds: [embed], components });
    }
}

// ==== SELECT MENU HANDLER ====

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    // Privacy toggle select
    if (interaction.customId.startsWith('group_privacy_toggle_select_')) {
        const group = await Group.findById(session.groupId);
        const sys = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!group.setting) group.setting = {};
        if (!group.setting.privacy) group.setting.privacy = [];

        let privacy = group.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            group.setting.privacy.push(privacy);
        }

        privacy.settings.hidden = privacy.settings.hidden === false ? true : false;
        await group.save();

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure who can see what information about this group.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const p = group.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (visible)';
                if (p?.settings?.hidden === false) status = '❌ Hidden';
                else if (p?.settings?.hidden === true) status = '✅ Visible';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`group_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy toggle ping select
    if (interaction.customId.startsWith('group_privacy_toggle_ping_select_')) {
        const group = await Group.findById(session.groupId);
        const sys = await System.findById(session.systemId);
        const bucketName = interaction.values[0];

        if (!group.setting) group.setting = {};
        if (!group.setting.privacy) group.setting.privacy = [];

        let privacy = group.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            group.setting.privacy.push(privacy);
        }

        privacy.settings.allowPing = privacy.settings.allowPing === false ? true : false;
        await group.save();

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings: ${utils.getDisplayName(group)}`)
            .setDescription('Configure who can see what information about this group.');

        if (sys.privacyBuckets?.length > 0) {
            for (const bucket of sys.privacyBuckets) {
                const p = group.setting?.privacy?.find(pr => pr.bucket === bucket.name);
                let status = 'Default (pings allowed)';
                if (p?.settings?.allowPing === false) status = '🔕 Pings disabled';
                else if (p?.settings?.allowPing === true) status = '🔔 Pings allowed';
                embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
            }
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`group_privacy_toggle_hidden_${sessionId}`).setLabel('Toggle Hidden').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`group_privacy_toggle_ping_${sessionId}`).setLabel('Toggle Pings').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId(`group_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    const group = await Group.findById(session.groupId);
    const system = await System.findById(session.systemId);
    const value = interaction.values[0];
    let modal;

    switch (value) {
        case 'card_info':
            modal = new ModalBuilder().setCustomId(`group_edit_card_modal_${sessionId}`).setTitle('Edit Card Info');
            const cardTarget = utils.getEditTarget(group, session);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('display_name').setLabel('Display Name').setStyle(TextInputStyle.Short).setValue(cardTarget?.name?.display || group.name?.display || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(cardTarget?.description || group.description || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color (hex)').setStyle(TextInputStyle.Short).setValue(cardTarget?.color || group.color || '').setRequired(false))
            );
            break;

        case 'type_info':
            modal = new ModalBuilder().setCustomId(`group_edit_type_modal_${sessionId}`).setTitle('Edit Type Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type_name').setLabel('Group Type').setStyle(TextInputStyle.Short).setValue(group.type?.name || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('can_front').setLabel('Can Front? (yes/no/sometimes)').setStyle(TextInputStyle.Short).setValue(group.type?.canFront || '').setRequired(false))
            );
            break;

        case 'aliases_info':
            modal = new ModalBuilder().setCustomId(`group_edit_aliases_modal_${sessionId}`).setTitle('Edit Aliases');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('aliases')
                        .setLabel('Aliases (comma-separated)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(group.name?.aliases?.join(', ') || '')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
            break;

        case 'proxy_info':
            modal = new ModalBuilder().setCustomId(`group_edit_proxy_modal_${sessionId}`).setTitle('Edit Proxy Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxies').setLabel('Proxies (one per line, use "text" as placeholder)').setStyle(TextInputStyle.Paragraph).setValue(group.proxy?.join('\n') || '').setPlaceholder('g:text\ntext -g\n-group text').setRequired(false).setMaxLength(500)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('signoff').setLabel('Sign-offs (one per line, emojis recommended)').setStyle(TextInputStyle.Paragraph).setValue(group.signoff || '').setPlaceholder('✨\n💫').setRequired(false).setMaxLength(200))
            );
            break;

        case 'image_info':
            const imageTarget = utils.getEditTarget(group, session);
            modal = new ModalBuilder().setCustomId(`group_edit_image_modal_${sessionId}`).setTitle('Edit Images');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avatar_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setValue(imageTarget?.avatar?.url || imageTarget?.image?.avatar?.url || group.avatar?.url || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner_url').setLabel('Banner URL').setStyle(TextInputStyle.Short).setValue(imageTarget?.image?.banner?.url || group.discord?.image?.banner?.url || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxy_avatar_url').setLabel('Proxy Avatar URL').setStyle(TextInputStyle.Short).setValue(imageTarget?.image?.proxyAvatar?.url || group.discord?.image?.proxyAvatar?.url || '').setRequired(false))
            );
            break;

        case 'caution_info':
            modal = new ModalBuilder().setCustomId(`group_edit_caution_modal_${sessionId}`).setTitle('Edit Caution');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caution_type').setLabel('Caution Type').setStyle(TextInputStyle.Short).setValue(group.caution?.c_type || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caution_detail').setLabel('Details').setStyle(TextInputStyle.Paragraph).setValue(group.caution?.detail || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trigger_names').setLabel('Triggers (comma-separated)').setStyle(TextInputStyle.Short).setValue(group.caution?.triggers?.map(t => t.name).join(', ') || '').setRequired(false))
            );
            break;

        case 'members_info':
            modal = new ModalBuilder().setCustomId(`group_edit_members_modal_${sessionId}`).setTitle('Edit Members');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('alter_names').setLabel('Alter names (comma-separated)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Enter alter indexable names').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('state_names').setLabel('State names (comma-separated)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Enter state indexable names').setRequired(false))
            );
            break;

        default:
            return await interaction.reply({ content: '❌ Unknown option.', ephemeral: true });
    }

    await interaction.showModal(modal);
}

// ==== MODAL HANDLER ====

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const group = await Group.findById(session.groupId);

    if (interaction.customId.startsWith('group_edit_card_modal_')) {
        utils.updateEntityProperty(group, session, 'name.display', interaction.fields.getTextInputValue('display_name'));
        utils.updateEntityProperty(group, session, 'description', interaction.fields.getTextInputValue('description'));
        utils.updateEntityProperty(group, session, 'color', interaction.fields.getTextInputValue('color'));
        await group.save();
        await proxyMessageHandler.invalidateDisplayCache(group._id);
    }

    if (interaction.customId.startsWith('group_edit_aliases_modal_')) {
        const aliasesInput = interaction.fields.getTextInputValue('aliases');
        if (!group.name) group.name = {};
        group.name.aliases = utils.parseCommaSeparated(aliasesInput);
        await group.save();
    }

    if (interaction.customId.startsWith('group_edit_type_modal_')) {
        if (!group.type) group.type = {};
        group.type.name = interaction.fields.getTextInputValue('type_name') || undefined;
        group.type.canFront = interaction.fields.getTextInputValue('can_front') || undefined;
        if (group.type.name) {
            const system = await System.findById(session.systemId);
            if (!system.groups.types) system.groups.types = [];
            if (!system.groups.types.includes(group.type.name)) {
                system.groups.types.push(group.type.name);
                await system.save();
            }
        }
        await group.save();
    }

    if (interaction.customId.startsWith('group_edit_proxy_modal_')) {
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
                group._id.toString(),
                'group'
            );

            if (duplicates.length > 0) {
                const dupList = duplicates.map(d => `\`${d.proxy}\` (used by ${d.owner})`).join('\n');

                // Still save valid proxies
                group.proxy = valid;
                group.signoff = signoff || undefined;
                await group.save();

                // Show warning about duplicates
                session.id = sessionId;
                const { embed, components } = buildEditInterface(group, session, system);
                return await interaction.update({
                    content: `⚠️ Some proxies were already in use and were skipped:\n${dupList}\n\nValid proxies were saved.`,
                    embeds: [embed],
                    components
                });
            }

            group.proxy = valid;
        } else group.proxy = [];   

        group.signoff = signoff || undefined;
        await group.save();
    }

    if (interaction.customId.startsWith('group_edit_image_modal_')) {
        const avatarUrl = interaction.fields.getTextInputValue('avatar_url');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url');
        const proxyAvatarUrl = interaction.fields.getTextInputValue('proxy_avatar_url');

        if (session.mode === 'mask') {
            if (!group.mask) group.mask = {};
            if (avatarUrl) group.mask.avatar = { url: avatarUrl };
            if (!group.mask.discord) group.mask.discord = { image: {} };
            if (!group.mask.discord.image) group.mask.discord.image = {};
            if (bannerUrl) group.mask.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) group.mask.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else if (!session.syncWithDiscord) {
            if (!group.discord) group.discord = {};
            if (!group.discord.image) group.discord.image = {};
            if (avatarUrl) group.discord.image.avatar = { url: avatarUrl };
            if (bannerUrl) group.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) group.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        } else {
            if (avatarUrl) group.avatar = { url: avatarUrl };
            if (!group.discord) group.discord = {};
            if (!group.discord.image) group.discord.image = {};
            if (bannerUrl) group.discord.image.banner = { url: bannerUrl };
            if (proxyAvatarUrl) group.discord.image.proxyAvatar = { url: proxyAvatarUrl };
        }
        await group.save();
        await proxyMessageHandler.invalidateDisplayCache(group._id);
    }

    if (interaction.customId.startsWith('group_edit_caution_modal_')) {
        if (!group.caution) group.caution = {};
        group.caution.c_type = interaction.fields.getTextInputValue('caution_type') || undefined;
        group.caution.detail = interaction.fields.getTextInputValue('caution_detail') || undefined;
        const triggers = interaction.fields.getTextInputValue('trigger_names');
        group.caution.triggers = triggers ? utils.parseCommaSeparated(triggers).map(name => ({ name })) : [];
        await group.save();
    }

    if (interaction.customId.startsWith('group_edit_members_modal_')) {
        const system = await System.findById(session.systemId);
        const alterNamesInput = interaction.fields.getTextInputValue('alter_names');
        const stateNamesInput = interaction.fields.getTextInputValue('state_names');

        const allAlters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
        const allStates = await State.find({ _id: { $in: system.states?.IDs || [] } });

        // Calculate new alter membership IDs
        const newAlterIds = [];
        for (const name of utils.parseCommaSeparated(alterNamesInput)) {
            const alter = allAlters.find(a => a.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (alter) newAlterIds.push(alter._id.toString());
        }

        // Calculate new state membership IDs
        const newStateIds = [];
        for (const name of utils.parseCommaSeparated(stateNamesInput)) {
            const state = allStates.find(s => s.name?.indexable?.toLowerCase() === name.toLowerCase());
            if (state) newStateIds.push(state._id.toString());
        }

        // Diff for alters (alter.groupsIDs)
        const oldAlterIds = group.alterIDs || [];
        const removedAlterIds = oldAlterIds.filter(id => !newAlterIds.includes(id));
        const addedAlterIds = newAlterIds.filter(id => !oldAlterIds.includes(id));

        // Diff for states (state.groupIDs)
        const oldStateIds = group.stateIDs || [];
        const removedStateIds = oldStateIds.filter(id => !newStateIds.includes(id));
        const addedStateIds = newStateIds.filter(id => !oldStateIds.includes(id));

        // Update group's own member arrays
        group.alterIDs = newAlterIds;
        group.stateIDs = newStateIds;
        await group.save();

        // Sync reverse: alter.groupsIDs (diff-based)
        if (removedAlterIds.length > 0) {
            await Alter.updateMany({ _id: { $in: removedAlterIds } }, { $pull: { groupsIDs: group._id.toString() } });
        }
        if (addedAlterIds.length > 0) {
            await Alter.updateMany({ _id: { $in: addedAlterIds } }, { $addToSet: { groupsIDs: group._id.toString() } });
        }

        // Sync reverse: state.groupIDs (diff-based)
        if (removedStateIds.length > 0) {
            await State.updateMany({ _id: { $in: removedStateIds } }, { $pull: { groupIDs: group._id.toString() } });
        }
        if (addedStateIds.length > 0) {
            await State.updateMany({ _id: { $in: addedStateIds } }, { $addToSet: { groupIDs: group._id.toString() } });
        }
    }

    if (interaction.customId.startsWith('group_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');
        if (!group.name) group.name = {};
        group.name.closedNameDisplay = closedName || null;
        await group.save();
        await proxyMessageHandler.invalidateDisplayCache(group._id);
        return await interaction.update({ content: `✅ Closed name: ${closedName || '*Not set*'}`, embeds: [], components: [] });
    }

    if (interaction.customId.startsWith('group_settings_status_modal_')) {
        const status = interaction.fields.getTextInputValue('default_status');
        if (!group.setting) group.setting = {};
        group.setting.default_status = status || null;
        await group.save();
        return await interaction.update({ content: `✅ Default status: ${status || '*Not set*'}`, embeds: [], components: [] });
    }

    session.id = sessionId;
    const { embed, components } = buildEditInterface(group, session, system);
    await interaction.update({ embeds: [embed], components });
}