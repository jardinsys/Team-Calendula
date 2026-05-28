// sys!profile - User profile prefix command
// Shows user profile card with system integration
//
// USAGE:
//   sys!profile                                    - Show your profile
//   sys!profile @User                              - Show another user's profile
//   sys!profile edit displayname <name>            - Edit profile display name
//   sys!profile edit notify                        - View notification settings
//   sys!profile edit notify method <dm|cmd|none>   - Set notification delivery
//   sys!profile edit notify friendreq <on|off>     - Toggle friend request alerts
//   sys!profile edit notify friendswitch <on|off>  - Toggle friend switch alerts
//   sys!profile edit notify appmessages <on|off>   - Toggle app message alerts

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'profile',
    aliases: ['prof'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (!firstArg || firstArg === 'help') return handleHelp(message);
        if (firstArg === 'edit') return handleEdit(message, parsed);
        
        // Default: show profile
        return handleShow(message, parsed);
    }
};

async function handleShow(message, parsed) {
    let targetUser = null;
    let targetSystem = null;
    let isOwner = false;

    // Check for user mention
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
        targetUser = await User.findOne({ discordID: mentionedUser.id });
        if (targetUser?.systemID) {
            targetSystem = await System.findById(targetUser.systemID);
        }
    } else {
        // Show own profile
        targetUser = await User.findOne({ discordID: message.author.id });
        if (targetUser?.systemID) {
            targetSystem = await System.findById(targetUser.systemID);
        }
        isOwner = true;
    }

    if (!targetUser) {
        return utils.error(message, isOwner ? 'You haven\'t used any commands yet. Try a slash command to get started!' : 'That user hasn\'t used the bot yet.');
    }

    const embed = new EmbedBuilder();
    const displayName = targetUser.discord?.name?.display || message.author?.displayName || targetUser.username || '(no name)';

    embed.setAuthor({
        name: displayName,
        iconURL: message.author?.displayAvatarURL() || message.author?.avatarURL()
    });

    if (targetSystem) {
        const sysName = targetSystem.name?.display || targetSystem.name?.indexable || 'Unnamed System';
        embed.setTitle(`${displayName}'s System`);
        embed.setColor(targetSystem.color || utils.ENTITY_COLORS.system);

        if (targetSystem.avatar?.url) {
            embed.setThumbnail(targetSystem.avatar.url);
        }

        const alterCount = targetSystem.alters?.IDs?.length || 0;
        const stateCount = targetSystem.states?.IDs?.length || 0;
        const groupCount = targetSystem.groups?.IDs?.length || 0;

        let overview = `**${targetSystem.alterSynonym?.plural || 'Alters'}:** ${alterCount}\n`;
        overview += `**States:** ${stateCount}\n`;
        overview += `**Groups:** ${groupCount}`;
        embed.addFields({ name: '📊 System', value: overview, inline: true });

        if (targetSystem.description) {
            embed.addFields({ name: 'Description', value: targetSystem.description, inline: false });
        }

        if (targetSystem.front?.status) {
            embed.addFields({ name: 'Front Status', value: targetSystem.front.status, inline: true });
        }
        if (targetSystem.battery !== undefined && targetSystem.battery !== null) {
            embed.addFields({ name: 'Battery', value: `${targetSystem.battery} ${utils.getBatteryEmoji(targetSystem.battery)}`, inline: true });
        }

        if (targetSystem.front?.layers?.length) {
            const fronters = [];
            for (const layer of targetSystem.front.layers) {
                if (layer.fronters?.length) {
                    const names = [];
                    for (const f of layer.fronters) {
                        const id = f.alterID || f.stateID || f.groupID;
                        names.push(`\`${id}\``);
                    }
                    fronters.push(`${layer.name || 'Main'}: ${names.join(', ')}`);
                }
            }
            if (fronters.length) {
                embed.addFields({ name: '🎭 Currently Fronting', value: fronters.join('\n'), inline: false });
            }
        }

        const tags = targetSystem.discord?.tag?.normal;
        if (tags?.length) {
            embed.addFields({ name: '🏷️ Tags', value: tags.join(' '), inline: true });
        }

        if (targetSystem.timezone) {
            embed.addFields({ name: '🕐 Timezone', value: targetSystem.timezone, inline: true });
        }

        embed.setFooter({ text: `System ID: ${targetSystem._id}` });
    } else {
        embed.setTitle(displayName);
        embed.setColor(utils.ENTITY_COLORS.info);
        embed.setDescription('*No system registered yet.*');
        embed.setFooter({ text: `User ID: ${targetUser.discordID}` });
    }

    return message.reply({ embeds: [embed] });
}

async function handleEdit(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!user) return utils.error(message, 'You need to use the bot first.');

    const field = parsed._positional[1]?.toLowerCase();
    if (!field) return utils.error(message, 'Please specify a field to edit. Available: displayname, notify');

    if (field === 'displayname' || field === 'dn') {
        if (parsed.clear) {
            user.discord = user.discord || {};
            user.discord.name = user.discord.name || {};
            user.discord.name.display = undefined;
            await user.save();
            return utils.success(message, 'Profile display name cleared.');
        }
        const newName = parsed._positional.slice(2).join(' ');
        if (!newName) return utils.error(message, 'Please provide a display name.');
        user.discord = user.discord || {};
        user.discord.name = user.discord.name || {};
        user.discord.name.display = newName;
        await user.save();
        return utils.success(message, `Profile display name set to **${newName}**`);
    }

    if (field === 'notify' || field === 'notification' || field === 'notif') {
        return handleNotify(message, parsed, user);
    }

    return utils.error(message, `Unknown field: ${field}. Available: displayname, notify`);
}

async function handleNotify(message, parsed, user) {
    const subField = parsed._positional[2]?.toLowerCase();
    if (!subField) return handleNotifyShow(message, user);

    if (subField === 'method' || subField === 'delivery') {
        const val = parsed._positional[3]?.toLowerCase();
        if (!val || !['dm', 'command', 'none'].includes(val)) {
            const current = user.settings?.notificationPreferences?.friendNotifications || 'dm';
            return utils.info(message, `Current notification delivery: **${current}**\nOptions: \`dm\`, \`command\`, \`none\`\nUsage: \`sys!profile edit notify method <dm|command|none>\``);
        }
        if (!user.settings) user.settings = {};
        if (!user.settings.notificationPreferences) user.settings.notificationPreferences = {};
        user.settings.notificationPreferences.friendNotifications = val;
        await user.save();
        return utils.success(message, `Notification delivery set to **${val}**`);
    }

    if (subField === 'friendreq' || subField === 'friendrequest' || subField === 'requests') {
        return handleNotifyToggle(message, parsed, user, 'friendRequests', 'Friend request notifications');
    }

    if (subField === 'friendswitch' || subField === 'switch' || subField === 'switches') {
        return handleNotifyToggle(message, parsed, user, 'friendSwitches', 'Friend switch notifications');
    }

    if (subField === 'appmessages' || subField === 'appmsg' || subField === 'app') {
        return handleNotifyToggle(message, parsed, user, 'appMessages', 'App message notifications');
    }

    return utils.error(message, `Unknown notification setting: ${subField}\nAvailable: method, friendreq, friendswitch, appmessages`);
}

async function handleNotifyToggle(message, parsed, user, prefKey, label) {
    const val = parsed._positional[3]?.toLowerCase();
    if (!val || !['on', 'off', 'true', 'false', 'yes', 'no'].includes(val)) {
        const current = user.settings?.notificationPreferences?.[prefKey] !== false ? 'on' : 'off';
        return utils.info(message, `${label} are currently **${current}**.\nUsage: \`sys!profile edit notify ${prefKey} <on|off>\``);
    }
    if (!user.settings) user.settings = {};
    if (!user.settings.notificationPreferences) user.settings.notificationPreferences = {};
    user.settings.notificationPreferences[prefKey] = ['on', 'true', 'yes'].includes(val);
    await user.save();
    return utils.success(message, `${label} are now **${user.settings.notificationPreferences[prefKey] ? 'on' : 'off'}**`);
}

async function handleNotifyShow(message, user) {
    const prefs = user.settings?.notificationPreferences || {};
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('🔔 Notification Settings')
        .addFields(
            {
                name: 'Friend Requests',
                value: prefs.friendRequests !== false ? '✅ Enabled' : '❌ Disabled',
                inline: true
            },
            {
                name: 'Delivery Method',
                value: prefs.friendNotifications === 'command' ? '💬 In Command' : prefs.friendNotifications === 'none' ? '❌ Disabled' : '📨 Discord DM',
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
        )
        .setFooter({ text: 'Use sys!profile edit notify <setting> <value> to change' });

    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('profile', 'View and manage your profile.', [
        { usage: 'sys!profile', description: 'Show your profile' },
        { usage: 'sys!profile @User', description: 'Show another user\'s profile' },
        { usage: 'sys!profile edit displayname <name>', description: 'Edit your profile display name' },
        { usage: 'sys!profile edit notify', description: 'View notification settings' },
        { usage: 'sys!profile edit notify method <dm|command|none>', description: 'Set notification delivery' },
        { usage: 'sys!profile edit notify friendreq <on|off>', description: 'Toggle friend request alerts' },
        { usage: 'sys!profile edit notify friendswitch <on|off>', description: 'Toggle friend switch alerts' },
        { usage: 'sys!profile edit notify appmessages <on|off>', description: 'Toggle app message alerts' },
    ]);
    return message.reply({ embeds: [embed] });
}
