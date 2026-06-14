// (/friend) - Systemiser Friend Management Command
// Manage friends, view friend fronts, send/receive requests, block users

// (/friend action:[list | view | add | remove | requests | block | unblock | settings])
// (/friend user:[@user] friend_id:[string])

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

const mongoose = require('mongoose');
const User = require('../../../schemas/user');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
const utils = require('../../functions/bot_utils');
const { publishEvent } = require('../../../redis');

const WEBAPP_URL = 'https://systemise.teamcalendula.net';
const ENTITY_COLORS = utils.ENTITY_COLORS;
const { getSystemTerm } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friend')
        .setDescription('Manage friends, view friend fronts, and handle requests')
        .addStringOption(opt => opt
            .setName('action')
            .setDescription('What to do')
            .setRequired(false)
            .addChoices(
                { name: 'List - View your friends list', value: 'list' },
                { name: 'View - See a friend\'s current front', value: 'view' },
                { name: 'Add - Send a friend request', value: 'add' },
                { name: 'Remove - Remove a friend', value: 'remove' },
                { name: 'Requests - Manage incoming friend requests', value: 'requests' },
                { name: 'Block - Block a user', value: 'block' },
                { name: 'Unblock - Unblock a user', value: 'unblock' },
                { name: 'Settings - Configure friend settings', value: 'settings' }
            ))
        .addUserOption(opt => opt
            .setName('user')
            .setDescription('Target user (for add/view/remove/block/unblock)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('friend_id')
            .setDescription('Friend ID to add (alternative to user mention)')
            .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'friend');

        switch (action) {
            case 'list': return await handleList(interaction, user, system);
            case 'view': return await handleView(interaction, user, system);
            case 'add': return await handleAdd(interaction, user, system);
            case 'remove': return await handleRemove(interaction, user, system);
            case 'requests': return await handleRequests(interaction, user, system);
            case 'block': return await handleBlock(interaction, user, system);
            case 'unblock': return await handleUnblock(interaction, user, system);
            case 'settings': return await handleSettings(interaction, user, system);
            default: return await handleList(interaction, user, system);
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ============================================
// LIST - Shows paginated friends list
// ============================================

async function handleList(interaction, user, system) {
    await interaction.deferReply({ ephemeral: true });

    if (!user.friends || user.friends.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setTitle('👥 Friends List')
            .setDescription('You haven\'t added any friends yet.\n\nUse `/friend action:add user:@User` or `/friend action:add friend_id:abc123` to send a friend request.');
        return interaction.editReply({ embeds: [embed] });
    }

    const friends = user.friends;
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('👥 Friends List')
        .setFooter({ text: `${friends.length} friend${friends.length !== 1 ? 's' : ''}` });

    let friendsText = '';
    for (const friend of friends) {
        const targetUser = await User.findOne({ discordID: friend.discordID });
        const targetSystem = targetUser?.systemID ? await System.findById(targetUser.systemID) : null;

        const displayName = friend.customName?.display || friend.customName?.indexable || friend.discordID;
        const systemName = targetSystem ? utils.getDisplayName(targetSystem) : 'No profile';

        // Get front status preview
        let statusPreview = '';
        if (targetSystem?.front?.status) statusPreview = ` | *${targetSystem.front.status}*`;
        if (targetSystem?.battery !== undefined && targetSystem?.battery !== null) {
            const battEmoji = utils.getBatteryEmoji(targetSystem.battery);
            statusPreview += ` ${battEmoji}${targetSystem.battery}%`;
        }

        friendsText += `• **${displayName}** — ${systemName}${statusPreview}\n`;
    }

    embed.setDescription(friendsText.trim() || 'No friends to display.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`friend_add_from_list_${user._id}`).setLabel('Add Friend').setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`friend_settings_btn_${user._id}`).setLabel('Settings').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
}

// ============================================
// VIEW - View a friend's current front
// ============================================

async function handleView(interaction, user, system) {
    const targetDiscordUser = interaction.options.getUser('user');

    if (!targetDiscordUser) {
        return await handleViewSelectMenu(interaction, user, system);
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });
    if (!targetUser) {
        return interaction.editReply({ content: '❌ This user hasn\'t set up a profile yet.', ephemeral: true });
    }

    if (!targetUser.systemID) {
        return interaction.editReply({ content: '❌ Not registered.', ephemeral: true });
    }

    if (utils.isBlocked(targetUser, interaction.user.id, user.friendID)) {
        return interaction.editReply({ content: '❌ This user\'s information is not available to you.', ephemeral: true });
    }

    const targetSystem = await System.findById(targetUser.systemID);
    if (!targetSystem) {
        return interaction.editReply({ content: '❌ Not registered.', ephemeral: true });
    }

    const privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, user.friendID);
    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    const embed = await buildFriendFrontEmbed(targetSystem, targetUser, user, privacyBucket, closedCharAllowed, interaction);

    return interaction.editReply({ embeds: [embed] });
}

async function handleViewSelectMenu(interaction, user, system) {
    await interaction.deferReply({ ephemeral: true });

    if (!user.friends || user.friends.length === 0) {
        return interaction.editReply({ content: '❌ You have no friends to view. Add some first!', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'friend_view_select', userId: user._id });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`friend_view_select_${sessionId}`)
        .setPlaceholder('Select a friend to view...')
        .setMinValues(1)
        .setMaxValues(1);

    for (const friend of user.friends) {
        const name = friend.customName?.display || friend.customName?.indexable || friend.discordID;
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(name)
                .setValue(friend.discordID)
        );
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.editReply({ components: [row], ephemeral: true });
}

async function buildFriendFrontEmbed(targetSystem, targetUser, viewerUser, privacyBucket, closedCharAllowed, interaction) {
    const systemName = utils.getDisplayName(targetSystem, closedCharAllowed);
    const targetUserName = targetUser.discord?.name?.display || utils.getFallbackName(interaction.user, interaction.user?.displayName);

    const embed = new EmbedBuilder()
        .setTitle(`🎭 ${systemName}'s Front`)
        .setTimestamp();

    const frontColor = utils.getSystemEmbedColor(targetSystem);
    if (frontColor) embed.setColor(frontColor);

    if (targetSystem.avatar?.url || targetSystem.discord?.image?.avatar?.url) {
        embed.setThumbnail(targetSystem.avatar?.url || targetSystem.discord?.image?.avatar?.url);
    }

    const systemPrivacy = targetSystem.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);

    let description = '';
    const showStatus = !systemPrivacy || systemPrivacy.settings?.hidden !== true;
    if (showStatus) {
        if (targetSystem.front?.status) description += `**Status:** ${targetSystem.front.status}\n`;
        if (targetSystem.battery !== undefined && targetSystem.battery !== null) {
            const batteryEmoji = utils.getBatteryEmoji(targetSystem.battery);
            description += `**Social Battery:** ${batteryEmoji} ${targetSystem.battery}%\n`;
        }
        if (targetSystem.front?.caution) description += `**⚠️ Caution:** ${targetSystem.front.caution}\n`;
    }
    if (description) embed.setDescription(description.trim());

    const layers = targetSystem.front?.layers || [];

    if (layers.length === 0) {
        embed.addFields({
            name: '📭 No Front Data',
            value: 'No one is currently marked as fronting.',
            inline: false
        });
    } else {
        for (const layer of layers) {
            const layerName = layer.name || 'Front';
            const fronters = [];

            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (!shift || shift.endTime) continue;

                const entity = await getEntityForShift(shift, targetSystem);
                if (!entity) {
                    fronters.push(`❓ **${shift.type_name}** (entity not found)`);
                    continue;
                }

                const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
                if (entityPrivacy?.settings?.hidden === true) continue;

                const emoji = shift.s_type === 'alter' ? '🎭' : (shift.s_type === 'state' ? '🔄' : '👥');
                const displayName = utils.getDisplayName(entity, closedCharAllowed);
                let fronterLine = `${emoji} **${displayName}**`;

                const pronounsVisible = !entityPrivacy || entityPrivacy.settings?.pronouns !== false;
                if (pronounsVisible && entity.pronouns?.length > 0) {
                    fronterLine += ` (${entity.pronouns.join('/')})`;
                }

                const currentStatus = shift.statuses?.[shift.statuses.length - 1];
                const statusVisible = !systemPrivacy || systemPrivacy.settings?.hidden !== true;
                if (statusVisible && currentStatus?.status) fronterLine += `\n   └ *${currentStatus.status}*`;

                if (statusVisible && currentStatus?.battery !== undefined && currentStatus?.battery !== null) {
                    const battEmoji = utils.getBatteryEmoji(currentStatus.battery);
                    fronterLine += ` | ${battEmoji} ${currentStatus.battery}%`;
                }

                if (statusVisible && currentStatus?.caution?.c_type) {
                    const cautionVisible = !entityPrivacy || entityPrivacy.settings?.caution !== false;
                    if (cautionVisible) {
                        fronterLine += `\n   └ ⚠️ ${currentStatus.caution.c_type}${currentStatus.caution.detail ? `: ${currentStatus.caution.detail}` : ''}`;
                    }
                }

                fronters.push(fronterLine);
            }

            if (fronters.length > 0) {
                embed.addFields({
                    name: layerName,
                    value: fronters.join('\n\n'),
                    inline: layers.length > 1
                });
            }
        }

        if (!embed.data.fields || embed.data.fields.length === 0) {
            embed.addFields({
                name: '📭 No Visible Data',
                value: 'No front data is visible based on privacy settings.',
                inline: false
            });
        }
    }

    embed.setFooter({
        text: `${targetUserName}'s ${getSystemTerm(targetSystem, {context:'ownership'})}`,
        iconURL: interaction.user.displayAvatarURL()
    });

    return embed;
}

async function getEntityForShift(shift, system) {
    try {
        switch (shift.s_type) {
            case 'alter': return await Alter.findById(shift.ID);
            case 'state': return await State.findById(shift.ID);
            case 'group': return await Group.findById(shift.ID);
            default: return null;
        }
    } catch {
        return null;
    }
}

// ============================================
// ADD - Send a friend request
// ============================================

async function handleAdd(interaction, user, system) {
    const targetDiscordUser = interaction.options.getUser('user');
    const friendIdInput = interaction.options.getString('friend_id');

    if (!targetDiscordUser && !friendIdInput) {
        return await handleAddNoArgs(interaction, user, system);
    }

    await interaction.deferReply({ ephemeral: true });

    let targetUser = null;

    if (targetDiscordUser) {
        targetUser = await User.findOne({ discordID: targetDiscordUser.id });
    } else if (friendIdInput) {
        targetUser = await User.findOne({ friendID: friendIdInput.trim() });
    }

    if (!targetUser) {
        return interaction.editReply({ content: '❌ User not found. Check the ID or mention and try again.', ephemeral: true });
    }

    if (targetUser.discordID === interaction.user.id) {
        return interaction.editReply({ content: '❌ You can\'t add yourself as a friend.', ephemeral: true });
    }

    if (utils.isBlocked(targetUser, interaction.user.id, user.friendID)) {
        return interaction.editReply({ content: '❌ This user has blocked you.', ephemeral: true });
    }

    const alreadyFriends = user.friends?.some(f => f.discordID === targetUser.discordID);
    if (alreadyFriends) {
        return interaction.editReply({ content: '❌ You are already friends with this user.', ephemeral: true });
    }

    const alreadyRequested = targetUser.friendRequests?.some(r => r.fromDiscordID === interaction.user.id);
    if (alreadyRequested) {
        return interaction.editReply({ content: '❌ You already have a pending request to this user.', ephemeral: true });
    }

    const targetSystem = targetUser.systemID ? await System.findById(targetUser.systemID) : null;
    const targetSystemName = targetSystem ? utils.getDisplayName(targetSystem) : 'No profile';
    const senderName = user.discord?.name?.display || interaction.user.displayName;
    const senderSystemName = system ? utils.getDisplayName(system) : 'No profile';

    if (!targetUser.friendRequests) targetUser.friendRequests = [];
    targetUser.friendRequests.push({
        fromDiscordID: interaction.user.id,
        fromFriendID: user.friendID,
        fromName: senderName,
        fromSystemName: senderSystemName,
        sentAt: new Date()
    });
    await targetUser.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'friend:request', systemId: system._id.toString() });

    // Handle notification based on user preferences
    const notifPrefs = targetUser.settings?.notificationPreferences || {};
    if (notifPrefs.friendRequests !== false) {
        const senderDisplayName = senderName + (senderSystemName !== 'No profile' ? ` (${senderSystemName})` : '');

        if (notifPrefs.friendNotifications === 'command') {
            // Queue as ephemeral notification
            utils.notificationManager.addNotification(targetUser.discordID, 'friend-request', {
                senderName: senderDisplayName,
                senderId: user.friendID
            });
        } else if (notifPrefs.friendNotifications === 'dm' || notifPrefs.friendNotifications === undefined) {
            // Send DM notification
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(ENTITY_COLORS.info)
                    .setTitle('👥 New Friend Request')
                    .setDescription(`**${senderName}** (${senderSystemName}) wants to add you as a friend!\n\nUse \`/friend action:requests\` to accept or decline.`);
                await interaction.client.users.cache.get(targetUser.discordID)?.send({ embeds: [dmEmbed] });
            } catch {
                // DM failed, queue as notification fallback
                utils.notificationManager.addNotification(targetUser.discordID, 'friend-request', {
                    senderName: senderDisplayName,
                    senderId: user.friendID
                });
            }
        }
    }


    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.success)
        .setTitle('✅ Friend Request Sent')
        .setDescription(`Request sent to **${targetUser.discord?.name?.display || targetUser.discordID}**.\n\nThey can accept it using \`/friend action:requests\`.`)
        .addFields(
            { name: 'From', value: `${senderName} (${senderSystemName})`, inline: true },
            { name: 'To', value: `${targetUser.discord?.name?.display || targetUser.discordID} (${targetSystemName})`, inline: true }
        );

    return interaction.editReply({ embeds: [embed] });
}

async function handleAddNoArgs(interaction, user, system) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('➕ Add a Friend')
        .setDescription('To add a friend, use one of these methods:\n\n' +
            '• **Mention a user:** `/friend action:add user:@User`\n' +
            '• **Use their Friend ID:** `/friend action:add friend_id:abc123`\n\n' +
            'Share your Friend ID below so others can add you!')
        .addFields({
            name: 'Your Friend ID',
            value: `\`${user.friendID}\``,
            inline: false
        });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`friend_copy_id_${user._id}`).setLabel('Copy Friend ID').setStyle(ButtonStyle.Primary).setEmoji('📋')
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
}

// ============================================
// REMOVE - Remove a friend
// ============================================

async function handleRemove(interaction, user, system) {
    const targetDiscordUser = interaction.options.getUser('user');

    if (targetDiscordUser) {
        return await handleRemoveByUser(interaction, user, targetDiscordUser);
    }

    await interaction.deferReply({ ephemeral: true });

    if (!user.friends || user.friends.length === 0) {
        return interaction.editReply({ content: '❌ You have no friends to remove.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'friend_remove_select', userId: user._id });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`friend_remove_select_${sessionId}`)
        .setPlaceholder('Select a friend to remove...')
        .setMinValues(1)
        .setMaxValues(1);

    for (const friend of user.friends) {
        const name = friend.customName?.display || friend.customName?.indexable || friend.discordID;
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(name)
                .setValue(friend.discordID)
        );
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.editReply({ components: [row], ephemeral: true });
}

async function handleRemoveByUser(interaction, user, targetDiscordUser) {
    await interaction.deferReply({ ephemeral: true });

    const friendIndex = user.friends?.findIndex(f => f.discordID === targetDiscordUser.id);
    if (friendIndex === -1 || friendIndex === undefined) {
        return interaction.editReply({ content: '❌ This user is not in your friends list.', ephemeral: true });
    }

    const friendName = user.friends[friendIndex].customName?.display || user.friends[friendIndex].customName?.indexable || targetDiscordUser.displayName;

    user.friends.splice(friendIndex, 1);
    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:removed', systemId: user.systemID.toString() });

    // Also remove from the target user's friends list
    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });
    if (targetUser) {
        const targetFriendIndex = targetUser.friends?.findIndex(f => f.discordID === user.discordID);
        if (targetFriendIndex !== -1 && targetFriendIndex !== undefined) {
            targetUser.friends.splice(targetFriendIndex, 1);
            await targetUser.save();
        }
    }

    return interaction.editReply({ content: `✅ Removed **${friendName}** from your friends list.`, ephemeral: true });
}

// ============================================
// REQUESTS - Manage incoming friend requests
// ============================================

async function handleRequests(interaction, user, system) {
    await interaction.deferReply({ ephemeral: true });

    if (!user.friendRequests || user.friendRequests.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setTitle('👥 Friend Requests')
            .setDescription('No pending friend requests.');
        return interaction.editReply({ embeds: [embed] });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'friend_requests', userId: user._id });

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('👥 Pending Friend Requests')
        .setDescription(`${user.friendRequests.length} pending request(s):`);

    for (let i = 0; i < user.friendRequests.length; i++) {
        const req = user.friendRequests[i];
        const timeAgo = Math.floor((Date.now() - new Date(req.sentAt).getTime()) / 60000);
        const timeStr = timeAgo < 1 ? 'just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

        embed.addFields({
            name: `${i + 1}. ${req.fromName}`,
            value: `From: **${req.fromSystemName}**\nSent: ${timeStr}`,
            inline: false
        });
    }

    const buttons = user.friendRequests.map((req, i) =>
        new ButtonBuilder()
            .setCustomId(`friend_req_accept_${i}_${sessionId}`)
            .setLabel(`Accept ${req.fromName}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    ).slice(0, 5);

    const declineButtons = user.friendRequests.map((req, i) =>
        new ButtonBuilder()
            .setCustomId(`friend_req_decline_${i}_${sessionId}`)
            .setLabel(`Decline ${req.fromName}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    ).slice(0, 5);

    const components = [];
    if (buttons.length > 0) components.push(new ActionRowBuilder().addComponents(buttons));
    if (declineButtons.length > 0) components.push(new ActionRowBuilder().addComponents(declineButtons));

    return interaction.editReply({ embeds: [embed], components, ephemeral: true });
}

// ============================================
// BLOCK - Block a user
// ============================================

async function handleBlock(interaction, user, system) {
    const targetDiscordUser = interaction.options.getUser('user');

    if (targetDiscordUser) {
        return await handleBlockByUser(interaction, user, targetDiscordUser);
    }

    await interaction.deferReply({ ephemeral: true });

    if (!user.blocked || user.blocked.length === 0) {
        return interaction.editReply({ content: '❌ No one to block. Use `/friend action:block user:@User` to block someone.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'friend_block_select', userId: user._id });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`friend_block_select_${sessionId}`)
        .setPlaceholder('Select a user to block...')
        .setMinValues(1)
        .setMaxValues(1);

    const alreadyBlockedIds = new Set(user.blocked.map(b => b.discordID));
    for (const friend of (user.friends || [])) {
        if (!alreadyBlockedIds.has(friend.discordID)) {
            const name = friend.customName?.display || friend.customName?.indexable || friend.discordID;
            selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(name)
                    .setValue(friend.discordID)
            );
        }
    }

    if (selectMenu.data.options.length === 0) {
        return interaction.editReply({ content: '❌ No available users to block.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.editReply({ components: [row], ephemeral: true });
}

async function handleBlockByUser(interaction, user, targetDiscordUser) {
    await interaction.deferReply({ ephemeral: true });

    if (targetDiscordUser.id === interaction.user.id) {
        return interaction.editReply({ content: '❌ You can\'t block yourself.', ephemeral: true });
    }

    const alreadyBlocked = user.blocked?.some(b => b.discordID === targetDiscordUser.id);
    if (alreadyBlocked) {
        return interaction.editReply({ content: '❌ This user is already blocked.', ephemeral: true });
    }

    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });
    const targetName = targetUser?.discord?.name?.display || targetDiscordUser.displayName;

    if (!user.blocked) user.blocked = [];
    user.blocked.push({
        name: { display: targetName, indexable: targetDiscordUser.username },
        discordID: targetDiscordUser.id,
        friendID: targetUser?.friendID || null,
        addedAt: new Date()
    });

    const friendIndex = user.friends?.findIndex(f => f.discordID === targetDiscordUser.id);
    if (friendIndex !== -1 && friendIndex !== undefined) {
        user.friends.splice(friendIndex, 1);
    }

    // Also remove the blocker from the target's friends list
    if (targetUser) {
        const targetFriendIndex = targetUser.friends?.findIndex(f => f.discordID === user.discordID);
        if (targetFriendIndex !== -1 && targetFriendIndex !== undefined) {
            targetUser.friends.splice(targetFriendIndex, 1);
            await targetUser.save();
        }
    }

    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:blocked', systemId: user.systemID.toString() });

    return interaction.editReply({ content: `✅ Blocked **${targetName}**. They have been removed from your friends list if they were on it.`, ephemeral: true });
}

// ============================================
// UNBLOCK - Unblock a user
// ============================================

async function handleUnblock(interaction, user, system) {
    const targetDiscordUser = interaction.options.getUser('user');

    if (targetDiscordUser) {
        return await handleUnblockByUser(interaction, user, targetDiscordUser);
    }

    await interaction.deferReply({ ephemeral: true });

    if (!user.blocked || user.blocked.length === 0) {
        return interaction.editReply({ content: '❌ No one is blocked.', ephemeral: true });
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'friend_unblock_select', userId: user._id });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`friend_unblock_select_${sessionId}`)
        .setPlaceholder('Select a user to unblock...')
        .setMinValues(1)
        .setMaxValues(1);

    for (const blocked of user.blocked) {
        const name = blocked.name?.display || blocked.name?.indexable || blocked.discordID;
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(name)
                .setValue(blocked.discordID)
        );
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.editReply({ components: [row], ephemeral: true });
}

async function handleUnblockByUser(interaction, user, targetDiscordUser) {
    await interaction.deferReply({ ephemeral: true });

    const blockedIndex = user.blocked?.findIndex(b => b.discordID === targetDiscordUser.id);
    if (blockedIndex === -1 || blockedIndex === undefined) {
        return interaction.editReply({ content: '❌ This user is not blocked.', ephemeral: true });
    }

    const blockedName = user.blocked[blockedIndex].name?.display || targetDiscordUser.displayName;
    user.blocked.splice(blockedIndex, 1);
    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:unblocked', systemId: user.systemID.toString() });

    return interaction.editReply({ content: `✅ Unblocked **${blockedName}**.`, ephemeral: true });
}

// ============================================
// SETTINGS - Configure friend settings
// ============================================

async function handleSettings(interaction, user, system) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('⚙️ Friend Settings')
        .addFields(
            { name: 'Your Friend ID', value: `\`${user.friendID}\``, inline: false },
            { name: 'Friends', value: `${user.friends?.length || 0}`, inline: true },
            { name: 'Blocked', value: `${user.blocked?.length || 0}`, inline: true },
            { name: 'Pending Requests', value: `${user.friendRequests?.length || 0}`, inline: true }
        );

    if (system) {
        const autoBucket = system.setting?.friendAutoBucket || 'None set';
        embed.addFields({ name: 'Default Privacy Bucket', value: autoBucket, inline: false });

        if (system.privacyBuckets?.length > 0) {
            const bucketList = system.privacyBuckets.map(b => `• ${b.name}`).join('\n');
            embed.addFields({ name: 'Privacy Buckets', value: bucketList, inline: false });
        }
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`friend_copy_id_${user._id}`).setLabel('Copy Friend ID').setStyle(ButtonStyle.Primary).setEmoji('📋'),
        new ButtonBuilder().setCustomId(`friend_set_bucket_${user._id}`).setLabel('Set Default Bucket').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
        new ButtonBuilder().setCustomId(`friend_notif_settings_${user._id}`).setLabel('Notification Settings').setStyle(ButtonStyle.Secondary).setEmoji('🔔')
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
}

// ============================================
// NOTIFICATION SETTINGS HANDLER
// ============================================

async function handleNotificationSettings(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace('friend_notif_settings_', '');
    const user = await User.findById(userId);
    if (!user) return interaction.editReply({ content: '❌ User not found.', ephemeral: true });

    const prefs = user.settings?.notificationPreferences || {};

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('🔔 Notification Settings')
        .addFields(
            {
                name: 'Friend Requests',
                value: prefs.friendRequests !== false ? '✅ Enabled' : '❌ Disabled',
                inline: true
            },
            {
                name: 'Delivery Method',
                value: prefs.friendNotifications === 'command' ? '💬 In Command' : prefs.friendNotifications === 'dm' ? '📨 Discord DM' : '📨 Discord DM (Default)',
                inline: true
            },
            {
                name: 'Friend Switches',
                value: prefs.friendSwitches !== false ? '✅ Enabled' : '❌ Disabled',
                inline: true
            },
            {
                name: 'App Messages',
                value: prefs.appMessages !== false ? '✅ Enabled' : '❌ Disabled',
                inline: true
            }
        );

    // Per-friend switch notification toggles
    if (user.friends?.length > 0) {
        const friendLines = user.friends.map(f => {
            const name = f.customName?.display || f.customName?.indexable || f.discordID;
            const status = f.notifyOnSwitch !== false ? '✅' : '❌';
            return `${status} ${name}`;
        }).join('\n');

        embed.addFields({
            name: 'Per-Friend Switch Notifications',
            value: friendLines || 'No friends',
            inline: false
        });
    }

    const components = [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`friend_notif_method_${userId}`)
                .setPlaceholder('Choose notification delivery method')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Discord DM')
                        .setValue('dm')
                        .setDescription('Receive notifications via Discord DMs')
                        .setDefault(prefs.friendNotifications === 'dm' || prefs.friendNotifications === undefined),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('In Command')
                        .setValue('command')
                        .setDescription('See notifications when you use commands')
                        .setDefault(prefs.friendNotifications === 'command'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('None')
                        .setValue('none')
                        .setDescription('Don\'t receive notifications')
                        .setDefault(prefs.friendNotifications === 'none')
                )
        )
    ];

    // Add per-friend toggle select if user has friends
    if (user.friends?.length > 0) {
        const friendOptions = user.friends.slice(0, 25).map(f => {
            const name = f.customName?.display || f.customName?.indexable || f.discordID;
            const isEnabled = f.notifyOnSwitch !== false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(name.substring(0, 100))
                .setValue(f.friendID || f.discordID)
                .setDescription(isEnabled ? 'Currently ON — tap to turn OFF' : 'Currently OFF — tap to turn ON')
                .setEmoji(isEnabled ? '✅' : '❌');
        });

        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`friend_notif_toggle_select_${userId}`)
                    .setPlaceholder('Toggle per-friend switch notifications')
                    .addOptions(friendOptions)
            )
        );
    }

    return interaction.editReply({ embeds: [embed], components });
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('friend_copy_id_')) {
        const userId = customId.replace('friend_copy_id_', '');
        const user = await User.findById(userId);
        if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

        return interaction.reply({ content: `📋 Your Friend ID: \`${user.friendID}\``, ephemeral: true });
    }

    if (customId.startsWith('friend_set_bucket_')) {
        const userId = customId.replace('friend_set_bucket_', '');
        const user = await User.findById(userId);
        if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

        const system = user.systemID ? await System.findById(user.systemID) : null;
        if (!system?.privacyBuckets?.length) {
            return interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, { type: 'friend_set_bucket', userId: user._id, systemId: system._id });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`friend_set_bucket_select_${sessionId}`)
            .setPlaceholder('Select default bucket for new friends...')
            .setMinValues(1)
            .setMaxValues(1);

        const currentBucket = system.setting?.friendAutoBucket;
        for (const bucket of system.privacyBuckets) {
            const emoji = bucket.name === currentBucket ? '✅' : '⬜';
            selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${emoji} ${bucket.name}`)
                    .setValue(bucket.name)
            );
        }

        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('❌ None (no default)')
                .setValue('__none__')
        );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({ components: [row], ephemeral: true });
    }

    if (customId.startsWith('friend_req_accept_')) {
        return await handleRequestAccept(interaction);
    }

    if (customId.startsWith('friend_req_decline_')) {
        return await handleRequestDecline(interaction);
    }

    if (customId.startsWith('friend_add_from_list_')) {
        return interaction.reply({ content: '💡 Use `/friend action:add user:@User` to send a friend request.', ephemeral: true });
    }

    if (customId.startsWith('friend_settings_btn_')) {
        const userId = customId.replace('friend_settings_btn_', '');
        const user = await User.findById(userId);
        const system = user?.systemID ? await System.findById(user.systemID) : null;
        if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        return await handleSettings(interaction, user, system);
    }

    return false;
}

async function handleRequestAccept(interaction) {
    const parts = interaction.customId.split('_');
    const reqIndex = parseInt(parts[3]);
    const sessionId = parts.slice(4).join('_');
    const session = utils.getSession(sessionId);

    if (!session || session.type !== 'friend_requests') {
        return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.friendRequests || !user.friendRequests[reqIndex]) {
        return interaction.reply({ content: '❌ Request not found.', ephemeral: true });
    }

    const request = user.friendRequests[reqIndex];
    const targetUser = await User.findOne({ discordID: request.fromDiscordID });

    if (!targetUser) {
        user.friendRequests.splice(reqIndex, 1);
        await user.save();
        return interaction.reply({ content: '❌ The sender no longer exists. Request removed.', ephemeral: true });
    }

    const alreadyFriends = user.friends?.some(f => f.discordID === targetUser.discordID);
    if (!alreadyFriends) {
        const targetSystem = targetUser.systemID ? await System.findById(targetUser.systemID) : null;
        const autoBucket = targetSystem?.setting?.friendAutoBucket || null;

        if (!user.friends) user.friends = [];
        user.friends.push({
            friendID: targetUser.friendID,
            customName: { display: targetUser.discord?.name?.display || targetUser.discordID },
            discordID: targetUser.discordID,
            addedAt: new Date(),
            privacyBucket: autoBucket,
            notifyOnSwitch: true
        });

        if (!targetUser.friends) targetUser.friends = [];
        const userSystem = user.systemID ? await System.findById(user.systemID) : null;
        const targetAutoBucket = userSystem?.setting?.friendAutoBucket || null;

        targetUser.friends.push({
            friendID: user.friendID,
            customName: { display: user.discord?.name?.display || user.discordID },
            discordID: user.discordID,
            addedAt: new Date(),
            privacyBucket: targetAutoBucket,
            notifyOnSwitch: true
        });

        await targetUser.save();
    }

    user.friendRequests.splice(reqIndex, 1);
    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:accepted', systemId: user.systemID.toString() });

    const friendName = request.fromName || targetUser.discord?.name?.display || utils.getFallbackName(interaction.user, interaction.user?.displayName);
    return interaction.update({
        content: `✅ You are now friends with **${friendName}**!`,
        embeds: [],
        components: []
    });
}

async function handleRequestDecline(interaction) {
    const parts = interaction.customId.split('_');
    const reqIndex = parseInt(parts[3]);
    const sessionId = parts.slice(4).join('_');
    const session = utils.getSession(sessionId);

    if (!session || session.type !== 'friend_requests') {
        return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.friendRequests || !user.friendRequests[reqIndex]) {
        return interaction.reply({ content: '❌ Request not found.', ephemeral: true });
    }

    const request = user.friendRequests[reqIndex];
    const friendName = request.fromName || utils.getFallbackName(interaction.user, interaction.user?.displayName);

    user.friendRequests.splice(reqIndex, 1);
    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:declined', systemId: user.systemID.toString() });

    return interaction.update({
        content: `❌ Declined friend request from **${friendName}**.`,
        embeds: [],
        components: []
    });
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('friend_view_select_')) {
        return await handleViewSelect(interaction);
    }

    if (customId.startsWith('friend_remove_select_')) {
        return await handleRemoveSelect(interaction);
    }

    if (customId.startsWith('friend_block_select_')) {
        return await handleBlockSelect(interaction);
    }

    if (customId.startsWith('friend_unblock_select_')) {
        return await handleUnblockSelect(interaction);
    }

    if (customId.startsWith('friend_set_bucket_select_')) {
        return await handleSetBucketSelect(interaction);
    }

    if (customId.startsWith('friend_notif_method_')) {
        return await handleNotificationMethodSelect(interaction);
    }

    if (customId.startsWith('friend_notif_toggle_select_')) {
        return await handlePerFriendToggle(interaction);
    }

    return false;
}

async function handleViewSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const targetDiscordId = interaction.values[0];
    const targetUser = await User.findOne({ discordID: targetDiscordId });
    if (!targetUser) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
    if (!targetUser.systemID) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const targetSystem = await System.findById(targetUser.systemID);
    const privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, user.friendID);
    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    const embed = await buildFriendFrontEmbed(targetSystem, targetUser, user, privacyBucket, closedCharAllowed, interaction);
    return interaction.update({ embeds: [embed], components: [] });
}

async function handleRemoveSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const targetDiscordId = interaction.values[0];
    const friendIndex = user.friends?.findIndex(f => f.discordID === targetDiscordId);
    if (friendIndex === -1 || friendIndex === undefined) {
        return interaction.reply({ content: '❌ Friend not found.', ephemeral: true });
    }

    const friendName = user.friends[friendIndex].customName?.display || user.friends[friendIndex].customName?.indexable || targetDiscordId;

    const confirmSessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(confirmSessionId, { type: 'friend_remove_confirm', userId: user._id, targetDiscordId, friendName });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`friend_remove_confirm_btn_${confirmSessionId}`).setLabel(`Remove ${friendName}`).setStyle(ButtonStyle.Danger).setEmoji('➖'),
        new ButtonBuilder().setCustomId(`friend_remove_cancel_btn_${confirmSessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ content: `Are you sure you want to remove **${friendName}** from your friends list?`, components: [row], ephemeral: true });
}

async function handleBlockSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const targetDiscordId = interaction.values[0];
    const targetUser = await User.findOne({ discordID: targetDiscordId });
    const targetName = targetUser?.discord?.name?.display || targetDiscordId;

    if (!user.blocked) user.blocked = [];
    user.blocked.push({
        name: { display: targetName, indexable: targetName },
        discordID: targetDiscordId,
        friendID: targetUser?.friendID || null,
        addedAt: new Date()
    });

    const friendIndex = user.friends?.findIndex(f => f.discordID === targetDiscordId);
    if (friendIndex !== -1 && friendIndex !== undefined) {
        user.friends.splice(friendIndex, 1);
    }

    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:blocked', systemId: user.systemID.toString() });
    return interaction.reply({ content: `✅ Blocked **${targetName}**.`, ephemeral: true });
}

async function handleUnblockSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const targetDiscordId = interaction.values[0];
    const blockedIndex = user.blocked?.findIndex(b => b.discordID === targetDiscordId);
    if (blockedIndex === -1 || blockedIndex === undefined) {
        return interaction.reply({ content: '❌ This user is not blocked.', ephemeral: true });
    }

    const blockedName = user.blocked[blockedIndex].name?.display || targetDiscordId;
    user.blocked.splice(blockedIndex, 1);
    await user.save();
    if (user.systemID) publishEvent(user.systemID.toString(), { type: 'friend:unblocked', systemId: user.systemID.toString() });

    return interaction.reply({ content: `✅ Unblocked **${blockedName}**.`, ephemeral: true });
}

async function handleSetBucketSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const selectedBucket = interaction.values[0];

    if (!system.setting) system.setting = {};
    system.setting.friendAutoBucket = selectedBucket === '__none__' ? null : selectedBucket;
    await system.save();

    const msg = selectedBucket === '__none__' ? '✅ Default privacy bucket cleared.' : `✅ Default privacy bucket set to: **${selectedBucket}**`;
    return interaction.reply({ content: msg, ephemeral: true });
}

async function handleNotificationMethodSelect(interaction) {
    const userId = interaction.customId.replace('friend_notif_method_', '');
    const user = await User.findById(userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const selectedMethod = interaction.values[0];

    if (!user.settings) user.settings = {};
    if (!user.settings.notificationPreferences) user.settings.notificationPreferences = {};

    user.settings.notificationPreferences.friendNotifications = selectedMethod;
    await user.save();

    const methodDisplay = {
        'dm': '📨 Discord DM',
        'command': '💬 In Command',
        'none': '❌ Disabled'
    };

    const msg = `✅ Notification delivery method set to: **${methodDisplay[selectedMethod]}**`;
    return interaction.reply({ content: msg, ephemeral: true });
}

async function handlePerFriendToggle(interaction) {
    const userId = interaction.customId.replace('friend_notif_toggle_select_', '');
    const user = await User.findById(userId);
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const friendId = interaction.values[0];
    const friend = user.friends?.find(f => f.friendID === friendId || f.discordID === friendId);
    if (!friend) return interaction.reply({ content: '❌ Friend not found.', ephemeral: true });

    // Toggle the value (default is true, so undefined/null also counts as true)
    friend.notifyOnSwitch = friend.notifyOnSwitch === false ? true : false;
    await user.save();

    const name = friend.customName?.display || friend.customName?.indexable || friend.discordID;
    const status = friend.notifyOnSwitch ? '✅ ON' : '❌ OFF';
    return interaction.reply({ content: `✅ Switch notifications for **${name}**: ${status}`, ephemeral: true });
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    return false;
}