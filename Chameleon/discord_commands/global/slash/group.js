// (/group) - Systemiser Group Management Command

// (/group menu)
// (/group showlist ) (click button to show full in ephemeral)
// (/group showlist user:[@user] userID:[string])

// (/group show user:[user]userID:[string] group_name:[string]) (click button to show all info in ephemeral)
// (/group show group_name:[string])

// (/group new group_name:[string])
// (/group delete group_name:[string])

// (/group group_name:[string] edit (have the select menu of what to edit (card info, personal info, proxy info, image info, caution info ) and have a buttons to (enter mask mode, open group settings, edit groups, edit states))
// (/group group_name:[string] settings

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

const Group = require('../../schemas/group');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');

// Import shared utilities
const utils = require('./systemiser-utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('group')
        .setDescription('Manage groups in your system')
        .addSubcommand(sub => sub.setName('menu').setDescription('Open the group management menu'))
        .addSubcommand(sub => sub.setName('showlist').setDescription('Show a list of groups')
            .addUserOption(opt => opt.setName('user').setDescription('Show groups for a specific user'))
            .addStringOption(opt => opt.setName('userid').setDescription('Discord User ID')))
        .addSubcommand(sub => sub.setName('show').setDescription('Show details of a specific group')
            .addStringOption(opt => opt.setName('group_name').setDescription('The group name').setRequired(true))
            .addUserOption(opt => opt.setName('user').setDescription('Show group from a specific user'))
            .addStringOption(opt => opt.setName('userid').setDescription('Discord User ID')))
        .addSubcommand(sub => sub.setName('new').setDescription('Create a new group')
            .addStringOption(opt => opt.setName('group_name').setDescription('The indexable name').setRequired(true)))
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit an existing group')
            .addStringOption(opt => opt.setName('group_name').setDescription('The group name').setRequired(true)))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a group')
            .addStringOption(opt => opt.setName('group_name').setDescription('The group name').setRequired(true)))
        .addSubcommand(sub => sub.setName('settings').setDescription('Open group settings')
            .addStringOption(opt => opt.setName('group_name').setDescription('The group name').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) {
            return await utils.handleNewUserFlow(interaction, 'group');
        }

        if (!system && !['showlist', 'show'].includes(subcommand)) {
            return await interaction.reply({
                content: '❌ You need to set up a system first. Use `/system` to get started.',
                ephemeral: true
            });
        }

        const handlers = {
            menu: handleMenu,
            showlist: handleShowList,
            show: handleShow,
            new: handleNew,
            edit: handleEdit,
            delete: handleDelete,
            settings: handleSettings
        };

        await handlers[subcommand](interaction, user, system);
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ============================================
// EMBED BUILDERS
// ============================================

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

async function buildGroupCard(group, system, privacyBucket, closedCharAllowed = true) {
    const embed = new EmbedBuilder();

    // Color priority: group.color > system.color > none
    const color = utils.getEntityEmbedColor(group, system);
    const description = utils.getDiscordOrDefault(group, 'description');
    const displayName = closedCharAllowed
        ? (group.name?.display || group.name?.indexable)
        : (group.name?.closedNameDisplay || group.name?.display || group.name?.indexable);

    const proxyAvatar = group.discord?.image?.proxyAvatar?.url || group.avatar?.url;
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
    if (group.type?.name) identInfo += `**Type:** ${group.type.name}\n`;
    if (group.type?.canFront) identInfo += `**Can Front:** ${group.type.canFront}\n`;

    embed.addFields({ name: '🏷️ Identification', value: identInfo.trim(), inline: false });

    if (group.caution && (group.caution.c_type || group.caution.detail || group.caution.triggers?.length)) {
        let cautionInfo = '';
        if (group.caution.c_type) cautionInfo += `**Type:** ${group.caution.c_type}\n`;
        if (group.caution.detail) cautionInfo += `**Details:** ${group.caution.detail}\n`;
        if (group.caution.triggers?.length) {
            cautionInfo += `**Triggers:** ${group.caution.triggers.map(t => t.name).filter(Boolean).join(', ')}\n`;
        }
        if (cautionInfo) embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
    }

    const avatar = group.discord?.image?.avatar?.url || group.avatar?.url;
    if (avatar) embed.setThumbnail(avatar);

    return embed;
}

function buildEditInterface(group, session) {
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

    return { embed, components: [selectRow, modeRow, actionRow] };
}

// ============================================
// COMMAND HANDLERS
// ============================================

async function handleMenu(interaction, user, system) {
    const embed = new EmbedBuilder()
        .setTitle('👥 Group Management')
        .setDescription('Select a button to start managing your groups.');

    // Use system color if available
    const menuColor = utils.getSystemEmbedColor(system);
    if (menuColor) embed.setColor(menuColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('group_menu_showlist').setLabel('Show List').setStyle(ButtonStyle.Primary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('group_menu_select').setLabel('Select Group').setStyle(ButtonStyle.Secondary).setEmoji('🔍')
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleShowList(interaction, currentUser, currentSystem) {
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;
        const User = require('../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser?.systemID) {
            return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });
        }

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) {
            return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });
        }

        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) {
            return await interaction.reply({ content: '❌ This user does not have a group list to show.', ephemeral: true });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) {
        return await interaction.reply({ content: '❌ No system found.', ephemeral: true });
    }

    const groups = await Group.find({ _id: { $in: targetSystem.groups?.IDs || [] } });
    if (groups.length === 0) {
        return await interaction.reply({ content: '📭 No groups found.', ephemeral: true });
    }

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
        const User = require('../../schemas/user');
        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser?.systemID) {
            return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });
        }

        targetSystem = await System.findById(otherUser.systemID);
        if (!targetSystem) {
            return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) {
        return await interaction.reply({ content: '❌ No system found.', ephemeral: true });
    }

    const group = await utils.findGroupByName(groupName, targetSystem);
    if (!group || (!isOwner && !utils.shouldShowEntity(group, privacyBucket, isOwner))) {
        return await interaction.reply({ content: '❌ Group cannot be found.', ephemeral: true });
    }

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildGroupCard(group, targetSystem, privacyBucket, closedCharAllowed);

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'show', groupId: group._id, systemId: targetSystem._id, isOwner });

    const buttons = isOwner ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_show_full_${sessionId}`).setLabel('Show All Info').setStyle(ButtonStyle.Primary).setEmoji('📄')
    )] : [];

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function handleNew(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');

    if (!utils.isValidIndexableName(groupName)) {
        return await interaction.reply({ content: '❌ Invalid name format. Use only letters, numbers, hyphens, and underscores.', ephemeral: true });
    }

    if (await utils.findGroupByName(groupName, system)) {
        return await interaction.reply({ content: '❌ A group with this name already exists.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'new', groupName: groupName.toLowerCase(), systemId: system._id, userId: user._id });

    const { embed, buttons } = utils.buildSyncConfirmation('group', groupName, sessionId, 'new');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleEdit(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');
    const group = await utils.findGroupByName(groupName, system);

    if (!group) {
        return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });
    }

    if (group.systemID !== system._id.toString()) {
        return await interaction.reply({ content: '❌ This group does not belong to your system.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'edit', groupId: group._id, systemId: system._id, mode: null, syncWithDiscord: group.syncWithApps?.discord || false });

    const { embed, buttons } = utils.buildSyncConfirmation('group', utils.getDisplayName(group), sessionId, 'edit');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleDelete(interaction, user, system) {
    const groupName = interaction.options.getString('group_name');
    const group = await utils.findGroupByName(groupName, system);

    if (!group) {
        return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });
    }

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

    if (!group) {
        return await interaction.reply({ content: '❌ Group not found.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'settings', groupId: group._id, systemId: system._id });

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Settings: ${utils.getDisplayName(group)}`)
        .addFields(
            { name: 'Closed Name', value: group.name?.closedNameDisplay || '*Not set*', inline: true },
            { name: 'Type', value: group.type?.name || '*Not set*', inline: true },
            { name: 'Can Front', value: group.type?.canFront || '*Not set*', inline: true }
        );

    // Color priority: group.color > system.color > none
    const settingsColor = utils.getEntityEmbedColor(group, system);
    if (settingsColor) embed.setColor(settingsColor);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_settings_closedname_${sessionId}`).setLabel('Closed Name').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`group_settings_privacy_${sessionId}`).setLabel('Privacy').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('new_user_')) {
        return await utils.handleNewUserButton(interaction, 'group');
    }

    if (customId === 'group_menu_showlist') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        return await handleShowList({ ...interaction, options: { getUser: () => null, getString: () => null } }, user, system);
    }

    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    // List navigation
    if (customId.startsWith('group_list_prev_')) session.page = Math.max(0, session.page - 1);
    if (customId.startsWith('group_list_next_')) session.page++;
    if (customId.startsWith('group_list_toggle_')) { session.showFullList = !session.showFullList; session.page = 0; }

    if (customId.startsWith('group_list_')) {
        const groups = session.showFullList ? session.allGroups : session.groups;
        const system = await System.findById(session.systemId);
        return await interaction.update({
            embeds: [buildGroupListEmbed(groups, session.page, system, session.showFullList)],
            components: utils.buildListButtons(groups.length, session.page, session.isOwner, session.showFullList, sessionId, 'group')
        });
    }

    // Show full
    if (customId.startsWith('group_show_full_')) {
        const group = await Group.findById(session.groupId);
        const system = await System.findById(session.systemId);
        const embed = await buildGroupCard(group, system, null, true);
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
        const { embed, components } = buildEditInterface(group, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Mode toggles
    if (customId.startsWith('group_edit_mode_mask_')) session.mode = session.mode === 'mask' ? null : 'mask';
    if (customId.startsWith('group_edit_mode_server_')) session.mode = session.mode === 'server' ? null : 'server';
    if (customId.startsWith('group_edit_mode_')) {
        const group = await Group.findById(session.groupId);
        const { embed, components } = buildEditInterface(group, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Done
    if (customId.startsWith('group_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Editing complete!', embeds: [], components: [] });
    }

    // Delete
    if (customId.startsWith('group_delete_confirm_')) {
        await Alter.updateMany({ groupsIDs: session.groupId.toString() }, { $pull: { groupsIDs: session.groupId.toString() } });
        await State.updateMany({ groupIDs: session.groupId.toString() }, { $pull: { groupIDs: session.groupId.toString() } });
        const system = await System.findById(session.systemId);
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
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    const group = await Group.findById(session.groupId);
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

        case 'proxy_info':
            modal = new ModalBuilder().setCustomId(`group_edit_proxy_modal_${sessionId}`).setTitle('Edit Proxy Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxies').setLabel('Proxies (one per line, use "text" as placeholder)').setStyle(TextInputStyle.Paragraph).setValue(group.proxy?.join('\n') || '').setPlaceholder('g:text\ntext -g\n-group text').setRequired(false).setMaxLength(500)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('signoff').setLabel('Sign-offs (one per line, emojis recommended)').setStyle(TextInputStyle.Paragraph).setValue(group.signoff || '').setPlaceholder('✨\n💫').setRequired(false).setMaxLength(200))
            );
            break;

        case 'image_info':
            modal = new ModalBuilder().setCustomId(`group_edit_image_modal_${sessionId}`).setTitle('Edit Images');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avatar_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setValue(group.avatar?.url || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner_url').setLabel('Banner URL').setStyle(TextInputStyle.Short).setValue(group.discord?.image?.banner?.url || '').setRequired(false))
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

// ============================================
// MODAL HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    const group = await Group.findById(session.groupId);

    if (interaction.customId.startsWith('group_edit_card_modal_')) {
        utils.updateEntityProperty(group, session, 'name.display', interaction.fields.getTextInputValue('display_name'));
        utils.updateEntityProperty(group, session, 'description', interaction.fields.getTextInputValue('description'));
        utils.updateEntityProperty(group, session, 'color', interaction.fields.getTextInputValue('color'));
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
                const { embed, components } = buildEditInterface(group, session);
                return await interaction.update({
                    content: `⚠️ Some proxies were already in use and were skipped:\n${dupList}\n\nValid proxies were saved.`,
                    embeds: [embed],
                    components
                });
            }

            group.proxy = valid;
        } else {
            group.proxy = [];
        }

        group.signoff = signoff || undefined;
        await group.save();
    }

    if (interaction.customId.startsWith('group_edit_image_modal_')) {
        const avatarUrl = interaction.fields.getTextInputValue('avatar_url');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url');

        if (session.mode === 'mask') {
            if (!group.mask) group.mask = { discord: { image: {} } };
            if (avatarUrl) group.mask.avatar = { url: avatarUrl };
            if (bannerUrl) group.mask.discord.image.banner = { url: bannerUrl };
        } else if (!session.syncWithDiscord) {
            if (!group.discord) group.discord = { image: {} };
            if (avatarUrl) group.discord.image.avatar = { url: avatarUrl };
            if (bannerUrl) group.discord.image.banner = { url: bannerUrl };
        } else {
            if (avatarUrl) group.avatar = { url: avatarUrl };
            if (!group.discord) group.discord = { image: {} };
            if (bannerUrl) group.discord.image.banner = { url: bannerUrl };
        }
        await group.save();
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
        const alterNames = interaction.fields.getTextInputValue('alter_names');
        const stateNames = interaction.fields.getTextInputValue('state_names');

        // Update alters
        await Alter.updateMany({ groupsIDs: group._id.toString() }, { $pull: { groupsIDs: group._id.toString() } });
        if (alterNames) {
            for (const name of utils.parseCommaSeparated(alterNames)) {
                await Alter.updateOne(
                    { _id: { $in: system.alters?.IDs || [] }, 'name.indexable': name.toLowerCase() },
                    { $addToSet: { groupsIDs: group._id.toString() } }
                );
            }
        }

        // Update states
        await State.updateMany({ groupIDs: group._id.toString() }, { $pull: { groupIDs: group._id.toString() } });
        if (stateNames) {
            for (const name of utils.parseCommaSeparated(stateNames)) {
                await State.updateOne(
                    { _id: { $in: system.states?.IDs || [] }, 'name.indexable': name.toLowerCase() },
                    { $addToSet: { groupIDs: group._id.toString() } }
                );
            }
        }
    }

    if (interaction.customId.startsWith('group_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');
        if (!group.name) group.name = {};
        group.name.closedNameDisplay = closedName || null;
        await group.save();
        return await interaction.update({ content: `✅ Closed name: ${closedName || '*Not set*'}`, embeds: [], components: [] });
    }

    session.id = sessionId;
    const { embed, components } = buildEditInterface(group, session);
    await interaction.update({ embeds: [embed], components });
}