// sys!friend - Friend Management Prefix Command
//
// USAGE:
//   sys!friend                              - List friends
//   sys!friend list                         - List friends
//   sys!friend add <@user|friend_id:abc>    - Send friend request
//   sys!friend remove <@user>               - Remove friend
//   sys!friend requests                     - View/manage incoming requests
//   sys!friend block <@user>                - Block a user
//   sys!friend unblock <@user>              - Unblock a user
//   sys!friend view [@user]                 - View friend's front
//   sys!friend settings                     - Friend settings
//   sys!friend settings defaultbucket <n>   - Set default privacy bucket

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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

const WEBAPP_URL = 'https://systemise.teamcalendula.net';
const ENTITY_COLORS = utils.ENTITY_COLORS;

module.exports = {
    name: 'friend',
    aliases: ['friends', 'fr'],

    async executeMessage(message, args) {
        const { user, system } = await utils.getOrCreateUserAndSystem(message);
        if (!user) return utils.error(message, 'Could not find or create your user profile.');

        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (!firstArg || firstArg === 'list') return handleList(message, user, system);
        if (firstArg === 'help') return handleHelp(message, user);

        const handlers = {
            'add': () => handleAdd(message, parsed, user, system),
            'remove': () => handleRemove(message, parsed, user),
            'rm': () => handleRemove(message, parsed, user),
            'requests': () => handleRequests(message, user),
            'req': () => handleRequests(message, user),
            'block': () => handleBlock(message, parsed, user),
            'unblock': () => handleUnblock(message, parsed, user),
            'view': () => handleView(message, parsed, user),
            'settings': () => handleSettings(message, parsed, user, system),
            'set': () => handleSettings(message, parsed, user, system),
        };

        if (handlers[firstArg]) return handlers[firstArg]();

        return utils.error(message, `(no name) subcommand: \`${firstArg}\`\nUse \`sys!friend help\` for available commands.`);
    }
};

async function handleList(message, user, system) {
    if (!user.friends || user.friends.length === 0) 
        return utils.info(message, 'You haven\'t added any friends yet.\nUse `sys!friend add @User` to send a friend request.');

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('👥 Friends List')
        .setFooter({ text: `${user.friends.length} friend${user.friends.length !== 1 ? 's' : ''}` });

    let friendsText = '';
    for (const friend of user.friends) {
        const targetUser = await User.findOne({ discordID: friend.discordID });
        const targetSystem = targetUser?.systemID ? await System.findById(targetUser.systemID) : null;

        const displayName = friend.customName?.display || friend.customName?.indexable || `<@${friend.discordID}>`;
        const systemName = targetSystem ? utils.getDisplayName(targetSystem) : 'No system';

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
        new ButtonBuilder().setLabel('Add Friend').setStyle(ButtonStyle.Link).setURL('https://discord.com/channels/@me').setEmoji('➕'),
        new ButtonBuilder().setCustomId(`friend_settings_btn_${user._id}`).setLabel('Settings').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    return message.reply({ embeds: [embed], components: [row] });
}

async function handleAdd(message, parsed, user, system) {
    const targetUser = message.mentions.users.first();
    const friendIdInput = parsed.friend_id || parsed['friend-id'];

    if (!targetUser && !friendIdInput) {
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setTitle('➕ Add a Friend')
            .setDescription('To add a friend, use one of these methods:\n\n' +
                '• **Mention a user:** `sys!friend add @User`\n' +
                '• **Use their Friend ID:** `sys!friend add friend_id:abc123`\n\n' +
                'Share your Friend ID below so others can add you!')
            .addFields({
                name: 'Your Friend ID',
                value: `\`${user.friendID}\``,
                inline: false
            });
        return message.reply({ embeds: [embed] });
    }

    let target = null;
    if (targetUser) target = await User.findOne({ discordID: targetUser.id });
    else if (friendIdInput) target = await User.findOne({ friendID: friendIdInput.trim() });

    if (!target) return utils.error(message, 'User not found. Check the ID or mention and try again.');
    if (target.discordID === message.author.id) return utils.error(message, 'You can\'t add yourself as a friend.');
    if (utils.isBlocked(target, message.author.id, user.friendID)) return utils.error(message, 'This user has blocked you.');

    const alreadyFriends = user.friends?.some(f => f.discordID === target.discordID);
    if (alreadyFriends) return utils.error(message, 'You are already friends with this user.');

    const alreadyRequested = target.friendRequests?.some(r => r.fromDiscordID === message.author.id);
    if (alreadyRequested) return utils.error(message, 'You already have a pending request to this user.');

    const targetSystem = target.systemID ? await System.findById(target.systemID) : null;
    const targetSystemName = targetSystem ? utils.getDisplayName(targetSystem) : 'No system';
    const senderName = user.discord?.name?.display || message.author.displayName;
    const senderSystemName = system ? utils.getDisplayName(system) : 'No system';

    if (!target.friendRequests) target.friendRequests = [];
    target.friendRequests.push({
        fromDiscordID: message.author.id,
        fromFriendID: user.friendID,
        fromName: senderName,
        fromSystemName: senderSystemName,
        sentAt: new Date()
    });
    await target.save();

    // DM notification
    const notifPrefs = target.settings?.notificationPreferences || {};
    if (notifPrefs.friendRequests !== false) {
        const senderDisplayName = senderName + (senderSystemName !== 'No system' ? ` (${senderSystemName})` : '');
        if (notifPrefs.friendNotifications === 'dm' || notifPrefs.friendNotifications === undefined) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(ENTITY_COLORS.info)
                    .setTitle('👥 New Friend Request')
                    .setDescription(`**${senderName}** (${senderSystemName}) wants to add you as a friend!\n\nUse \`sys!friend requests\` to accept or decline.`);
                await message.client.users.cache.get(target.discordID)?.send({ embeds: [dmEmbed] });
            } catch { /* DM failed, silently ignore */ }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.success)
        .setTitle('✅ Friend Request Sent')
        .setDescription(`Request sent to **${target.discord?.name?.display || target.discordID}**.\n\nThey can accept it using \`sys!friend requests\`.`)
        .addFields(
            { name: 'From', value: `${senderName} (${senderSystemName})`, inline: true },
            { name: 'To', value: `${target.discord?.name?.display || target.discordID} (${targetSystemName})`, inline: true }
        );

    return message.reply({ embeds: [embed] });
}

async function handleRemove(message, parsed, user) {
    const targetUser = message.mentions.users.first();

    if (targetUser) {
        const friendIndex = user.friends?.findIndex(f => f.discordID === targetUser.id);
        if (friendIndex === -1 || friendIndex === undefined)
            return utils.error(message, 'This user is not in your friends list.');

        if (!parsed.confirm) {
            const friendName = user.friends[friendIndex].customName?.display || user.friends[friendIndex].customName?.indexable || targetUser.displayName;
            const embed = new EmbedBuilder()
                .setColor(ENTITY_COLORS.warning)
                .setTitle('⚠️ Remove Friend?')
                .setDescription(`Are you sure you want to remove **${friendName}** from your friends list?`)
                .addFields({ name: 'To confirm', value: `\`sys!friend remove <@user> -confirm\`` });
            return message.reply({ embeds: [embed] });
        }

        const friendName = user.friends[friendIndex].customName?.display || user.friends[friendIndex].customName?.indexable || targetUser.displayName;
        user.friends.splice(friendIndex, 1);
        await user.save();
        return utils.success(message, `Removed **${friendName}** from your friends list.`);
    }

    // No mention — show select menu
    if (!user.friends || user.friends.length === 0) 
        return utils.error(message, 'You have no friends to remove.');

    const sessionId = utils.generateSessionId(message.author.id);
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
    return message.reply({ content: 'Select a friend to remove:', components: [row] });
}

async function handleRequests(message, user) {
    if (!user.friendRequests || user.friendRequests.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setTitle('👥 Friend Requests')
            .setDescription('No pending friend requests.');
        return message.reply({ embeds: [embed] });
    }

    const sessionId = utils.generateSessionId(message.author.id);
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

    return message.reply({ embeds: [embed], components });
}

async function handleBlock(message, parsed, user) {
    const targetUser = message.mentions.users.first();

    if (!targetUser)
        return utils.error(message, 'Please mention a user to block.\nUsage: `sys!friend block @User`');

    if (targetUser.id === message.author.id) return utils.error(message, 'You can\'t block yourself.');

    const alreadyBlocked = user.blocked?.some(b => b.discordID === targetUser.id);
    if (alreadyBlocked) return utils.error(message, 'This user is already blocked.');

    const targetDb = await User.findOne({ discordID: targetUser.id });
    const targetName = targetDb?.discord?.name?.display || targetUser.displayName;

    if (!user.blocked) user.blocked = [];
    user.blocked.push({
        name: { display: targetName, indexable: targetUser.username },
        discordID: targetUser.id,
        friendID: targetDb?.friendID || null,
        addedAt: new Date()
    });

    const friendIndex = user.friends?.findIndex(f => f.discordID === targetUser.id);
    if (friendIndex !== -1 && friendIndex !== undefined)
        user.friends.splice(friendIndex, 1);

    await user.save();
    return utils.success(message, `Blocked **${targetName}**. They have been removed from your friends list if they were on it.`);
}

async function handleUnblock(message, parsed, user) {
    const targetUser = message.mentions.users.first();

    if (!targetUser) return utils.error(message, 'Please mention a user to unblock.\nUsage: `sys!friend unblock @User`');

    const blockedIndex = user.blocked?.findIndex(b => b.discordID === targetUser.id);
    if (blockedIndex === -1 || blockedIndex === undefined) 
        return utils.error(message, 'This user is not blocked.');

    const blockedName = user.blocked[blockedIndex].name?.display || targetUser.displayName;
    user.blocked.splice(blockedIndex, 1);
    await user.save();
    return utils.success(message, `Unblocked **${blockedName}**.`);
}

async function handleView(message, parsed, user) {
    const targetUser = message.mentions.users.first();

    if (!targetUser) {
        // No mention — show select menu
        if (!user.friends || user.friends.length === 0)
            return utils.error(message, 'You have no friends to view. Add some first!');

        const sessionId = utils.generateSessionId(message.author.id);
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
        return message.reply({ content: 'Select a friend to view their front:', components: [row] });
    }

    const targetDb = await User.findOne({ discordID: targetUser.id });
    if (!targetDb) return utils.error(message, 'This user hasn\'t set up a profile yet.');
    if (!targetDb.systemID) return utils.error(message, 'This user doesn\'t have a system set up.');
    if (utils.isBlocked(targetDb, message.author.id, user.friendID)) {
        return utils.error(message, 'This user\'s information is not available to you.');
    }

    const targetSystem = await System.findById(targetDb.systemID);
    if (!targetSystem) return utils.error(message, 'System not found.');

    const privacyBucket = utils.getPrivacyBucket(targetSystem, message.author.id, user.friendID);
    const closedCharAllowed = await utils.checkClosedCharAllowed(message.guild);

    const embed = await buildFriendFrontEmbed(targetSystem, targetDb, user, privacyBucket, closedCharAllowed, message);
    return message.reply({ embeds: [embed] });
}

async function buildFriendFrontEmbed(targetSystem, targetUser, viewerUser, privacyBucket, closedCharAllowed, message) {
    const systemName = utils.getDisplayName(targetSystem, closedCharAllowed);
    const targetUserName = targetUser.discord?.name?.display || '(no name)';

    const embed = new EmbedBuilder()
        .setTitle(`🎭 ${systemName}'s Front`)
        .setTimestamp();

    const frontColor = utils.getSystemEmbedColor(targetSystem);
    if (frontColor) embed.setColor(frontColor);

    if (targetSystem.avatar?.url || targetSystem.discord?.image?.avatar?.url) 
        embed.setThumbnail(targetSystem.avatar?.url || targetSystem.discord?.image?.avatar?.url);

    const systemPrivacy = targetSystem.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);

    let description = '';
    const showStatus = !systemPrivacy || systemPrivacy.settings?.front?.hidden !== true;
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

                const entity = await getEntityForShift(shift);
                if (!entity) {
                    fronters.push(`❓ **${shift.type_name}** (entity not found)`);
                    continue;
                }

                const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
                if (entityPrivacy?.settings?.hidden === false) continue;

                const emoji = shift.s_type === 'alter' ? '🎭' : (shift.s_type === 'state' ? '🔄' : '👥');
                const displayName = utils.getDisplayName(entity, closedCharAllowed);
                let fronterLine = `${emoji} **${displayName}**`;

                const pronounsVisible = !entityPrivacy || entityPrivacy.settings?.pronouns !== false;
                if (pronounsVisible && entity.pronouns?.length > 0) 
                    fronterLine += ` (${entity.pronouns.join('/')})`;

                const currentStatus = shift.statuses?.[shift.statuses.length - 1];
                const statusVisible = !systemPrivacy || systemPrivacy.settings?.front?.hidden !== true;
                if (statusVisible && currentStatus?.status) fronterLine += `\n   └ *${currentStatus.status}*`;

                if (statusVisible && currentStatus?.battery !== undefined && currentStatus?.battery !== null) {
                    const battEmoji = utils.getBatteryEmoji(currentStatus.battery);
                    fronterLine += ` | ${battEmoji} ${currentStatus.battery}%`;
                }

                if (statusVisible && currentStatus?.caution?.c_type) {
                    const cautionVisible = !entityPrivacy || entityPrivacy.settings?.caution !== false;
                    if (cautionVisible)
                        fronterLine += `\n   └ ⚠️ ${currentStatus.caution.c_type}${currentStatus.caution.detail ? `: ${currentStatus.caution.detail}` : ''}`;
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

    embed.setFooter({ text: `${targetUserName}'s system` });
    return embed;
}

async function getEntityForShift(shift) {
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

async function handleSettings(message, parsed, user, system) {
    const subArg = parsed._positional[1]?.toLowerCase();

    if (subArg === 'defaultbucket' || subArg === 'db') 
        return handleDefaultBucket(message, parsed, user, system);

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
        new ButtonBuilder().setCustomId(`friend_set_bucket_${user._id}`).setLabel('Set Default Bucket').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
    );

    return message.reply({ embeds: [embed], components: [row] });
}

async function handleDefaultBucket(message, parsed, user, system) {
    if (!system) return utils.error(message, 'You need a system to set a default privacy bucket.');
    if (!system.privacyBuckets?.length) return utils.error(message, 'No privacy buckets configured. Use `sys!system privacy buckets create <name>` first.');

    const bucketName = parsed._positional.slice(2).join(' ') || parsed.bucket || parsed.name;
    if (!bucketName) {
        const bucketList = system.privacyBuckets.map(b => `• ${b.name}`).join('\n');
        return utils.info(message, `Available buckets:\n${bucketList}\n\nUsage: \`sys!friend settings defaultbucket <name>\``);
    }

    const bucketExists = system.privacyBuckets.some(b => b.name.toLowerCase() === bucketName.toLowerCase());
    if (!bucketExists) return utils.error(message, `Bucket \`${bucketName}\` not found.`);

    const matchedBucket = system.privacyBuckets.find(b => b.name.toLowerCase() === bucketName.toLowerCase());
    if (!system.setting) system.setting = {};
    system.setting.friendAutoBucket = matchedBucket.name;
    await system.save();

    return utils.success(message, `Default privacy bucket set to: **${matchedBucket.name}**`);
}

async function handleHelp(message, user) {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle('👥 Friend Commands')
        .setDescription('Manage friends, view friend fronts, and handle requests.')
        .addFields(
            { name: 'List & View', value:
                '`sys!friend` - List your friends\n' +
                '`sys!friend view @User` - View a friend\'s front\n' +
                '`sys!friend view` - Select a friend to view', inline: false },
            { name: 'Manage', value:
                '`sys!friend add @User` - Send friend request\n' +
                '`sys!friend add friend_id:abc` - Add by Friend ID\n' +
                '`sys!friend remove @User -confirm` - Remove friend\n' +
                '`sys!friend requests` - Accept/decline requests', inline: false },
            { name: 'Block', value:
                '`sys!friend block @User` - Block a user\n' +
                '`sys!friend unblock @User` - Unblock a user', inline: false },
            { name: 'Settings', value:
                '`sys!friend settings` - View settings\n' +
                '`sys!friend settings defaultbucket <name>` - Set auto-bucket', inline: false }
        );

    return message.reply({ embeds: [embed] });
}
