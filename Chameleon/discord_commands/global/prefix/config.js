// sys!config - Server configuration (admin only)
// This command is PREFIX ONLY - no slash command equivalent
//
// USAGE:
//   sys!config                           - Show current server settings
//   sys!config proxy <on|off>            - Enable/disable proxying server-wide
//   sys!config autoproxy <on|off>        - Allow/force-disable autoproxy
//   sys!config closedchar <on|off>       - Allow/disallow special characters
//   sys!config channel blacklist <#channel>
//   sys!config channel whitelist <#channel>
//   sys!config channel remove <#channel>
//   sys!config channel clear
//   sys!config channel list
//   sys!config log <#channel>            - Set log channel
//   sys!config log off                   - Disable logging
//   sys!config log events <proxy|edit|delete> <on|off>
//   sys!config admin add <@role|@user>
//   sys!config admin remove <@role|@user>
//   sys!config admin list

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Guild = require('../../schemas/guild');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'config',
    aliases: ['cfg', 'serverconfig', 'servercfg'],

    async executeMessage(message, args) {
        // Must be in a guild
        if (!message.guild) {
            return utils.error(message, 'This command can only be used in a server.');
        }

        // Check permissions
        const hasPermission = await checkAdminPermission(message);
        if (!hasPermission) {
            return utils.error(message, 'You need to be a server admin or have Manage Server permission to use this command.');
        }

        const parsed = utils.parseArgs(args);
        const subcommand = parsed._positional[0]?.toLowerCase();

        // Get or create guild settings
        let guild = await Guild.findOne({ id: message.guild.id });
        if (!guild) {
            guild = new Guild({
                id: message.guild.id,
                userIDs: [],
                admins: { roleIDs: [], memberIDs: [] },
                channels: { blacklist: [], whitelist: [], logEvents: {} },
                settings: {}
            });
            await guild.save();
        }

        // Route to handler
        const handlers = {
            'proxy': () => handleProxy(message, parsed, guild),
            'autoproxy': () => handleAutoproxy(message, parsed, guild),
            'ap': () => handleAutoproxy(message, parsed, guild),
            'closedchar': () => handleClosedChar(message, parsed, guild),
            'closed': () => handleClosedChar(message, parsed, guild),
            'channel': () => handleChannel(message, parsed, guild),
            'channels': () => handleChannel(message, parsed, guild),
            'log': () => handleLog(message, parsed, guild),
            'logging': () => handleLog(message, parsed, guild),
            'admin': () => handleAdmin(message, parsed, guild),
            'admins': () => handleAdmin(message, parsed, guild),
            'help': () => handleHelp(message)
        };

        if (!subcommand || !handlers[subcommand]) {
            return handleShow(message, guild);
        }

        return handlers[subcommand]();
    }
};

/**
 * Check if user has admin permission for config
 */
async function checkAdminPermission(message) {
    // Server owner always has permission
    if (message.guild.ownerId === message.author.id) return true;
    
    // Check Discord Manage Server permission
    if (message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    
    // Check Systemiser admin roles/members
    const guild = await Guild.findOne({ id: message.guild.id });
    if (guild) {
        // Check if user is in admin members
        if (guild.admins?.memberIDs?.includes(message.author.id)) return true;
        
        // Check if user has any admin role
        const memberRoles = message.member.roles.cache.map(r => r.id);
        if (guild.admins?.roleIDs?.some(roleId => memberRoles.includes(roleId))) return true;
    }
    
    return false;
}

/**
 * Show current server configuration
 */
async function handleShow(message, guild) {
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle(`⚙️ ${message.guild.name} - Systemiser Config`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }));

    // Proxy settings
    const proxyStatus = guild.settings?.allowProxy !== false ? '✅ Enabled' : '❌ Disabled';
    const autoproxyStatus = guild.settings?.forceDisableAutoproxy ? '❌ Force Disabled' : '✅ Allowed';
    const closedCharStatus = guild.settings?.closedCharAllowed !== false ? '✅ Allowed' : '❌ Restricted';

    embed.addFields({
        name: '🔧 General Settings',
        value: [
            `**Proxying:** ${proxyStatus}`,
            `**Autoproxy:** ${autoproxyStatus}`,
            `**Special Characters:** ${closedCharStatus}`
        ].join('\n'),
        inline: false
    });

    // Channel settings
    const blacklist = guild.channels?.blacklist || [];
    const whitelist = guild.channels?.whitelist || [];
    
    let channelInfo = '';
    if (whitelist.length > 0) {
        channelInfo = `**Whitelist Mode:** Only ${whitelist.length} channel(s) allow proxying\n`;
        channelInfo += whitelist.slice(0, 5).map(id => `<#${id}>`).join(', ');
        if (whitelist.length > 5) channelInfo += ` (+${whitelist.length - 5} more)`;
    } else if (blacklist.length > 0) {
        channelInfo = `**Blacklisted:** ${blacklist.length} channel(s)\n`;
        channelInfo += blacklist.slice(0, 5).map(id => `<#${id}>`).join(', ');
        if (blacklist.length > 5) channelInfo += ` (+${blacklist.length - 5} more)`;
    } else {
        channelInfo = '*All channels allow proxying*';
    }

    embed.addFields({
        name: '📝 Channel Restrictions',
        value: channelInfo,
        inline: false
    });

    // Logging
    const logChannel = guild.channels?.logChannel;
    const logEvents = guild.channels?.logEvents || {};
    let logInfo = logChannel ? `**Channel:** <#${logChannel}>\n` : '*Logging disabled*\n';
    if (logChannel) {
        const events = [];
        if (logEvents.proxy !== false) events.push('proxy');
        if (logEvents.edit) events.push('edit');
        if (logEvents.delete) events.push('delete');
        logInfo += `**Events:** ${events.length ? events.join(', ') : 'none'}`;
    }

    embed.addFields({
        name: '📋 Logging',
        value: logInfo,
        inline: false
    });

    // Admins
    const adminRoles = guild.admins?.roleIDs || [];
    const adminMembers = guild.admins?.memberIDs || [];
    let adminInfo = '';
    if (adminRoles.length > 0) {
        adminInfo += `**Roles:** ${adminRoles.map(id => `<@&${id}>`).join(', ')}\n`;
    }
    if (adminMembers.length > 0) {
        adminInfo += `**Members:** ${adminMembers.map(id => `<@${id}>`).join(', ')}`;
    }
    if (!adminInfo) {
        adminInfo = '*Only server admins with Manage Server permission*';
    }

    embed.addFields({
        name: '👑 Bot Admins',
        value: adminInfo,
        inline: false
    });

    embed.setFooter({ text: 'Use sys!config help for command list' });

    return message.reply({ embeds: [embed] });
}

/**
 * Handle proxy on/off
 */
async function handleProxy(message, parsed, guild) {
    const value = parsed._positional[1]?.toLowerCase();
    
    if (!value || !['on', 'off', 'enable', 'disable'].includes(value)) {
        const current = guild.settings?.allowProxy !== false ? 'enabled' : 'disabled';
        return utils.info(message, `Proxying is currently **${current}**.\nUse \`sys!config proxy on\` or \`sys!config proxy off\` to change.`);
    }

    const enable = ['on', 'enable'].includes(value);
    guild.settings = guild.settings || {};
    guild.settings.allowProxy = enable;
    await guild.save();

    return utils.success(message, `Proxying is now **${enable ? 'enabled' : 'disabled'}** server-wide.`);
}

/**
 * Handle autoproxy force disable
 */
async function handleAutoproxy(message, parsed, guild) {
    const value = parsed._positional[1]?.toLowerCase();
    
    if (!value || !['on', 'off', 'enable', 'disable'].includes(value)) {
        const current = guild.settings?.forceDisableAutoproxy ? 'force disabled' : 'allowed';
        return utils.info(message, `Autoproxy is currently **${current}**.\nUse \`sys!config autoproxy on\` to allow or \`sys!config autoproxy off\` to force disable.`);
    }

    // on = allow autoproxy, off = force disable
    const allow = ['on', 'enable'].includes(value);
    guild.settings = guild.settings || {};
    guild.settings.forceDisableAutoproxy = !allow;
    await guild.save();

    if (allow) {
        return utils.success(message, 'Autoproxy is now **allowed**. Users can use their autoproxy settings.');
    } else {
        return utils.success(message, 'Autoproxy is now **force disabled**. Users must use proxy tags to proxy.');
    }
}

/**
 * Handle closed character setting
 */
async function handleClosedChar(message, parsed, guild) {
    const value = parsed._positional[1]?.toLowerCase();
    
    if (!value || !['on', 'off', 'enable', 'disable'].includes(value)) {
        const current = guild.settings?.closedCharAllowed !== false ? 'allowed' : 'restricted';
        return utils.info(message, `Special characters are currently **${current}**.\nUse \`sys!config closedchar on\` to allow or \`sys!config closedchar off\` to restrict.`);
    }

    const allow = ['on', 'enable'].includes(value);
    guild.settings = guild.settings || {};
    guild.settings.closedCharAllowed = allow;
    await guild.save();

    if (allow) {
        return utils.success(message, 'Special characters are now **allowed** in proxy names.');
    } else {
        return utils.success(message, 'Special characters are now **restricted**. Users\' `closedNameDisplay` will be used instead.');
    }
}

/**
 * Handle channel blacklist/whitelist
 */
async function handleChannel(message, parsed, guild) {
    const action = parsed._positional[1]?.toLowerCase();
    
    guild.channels = guild.channels || { blacklist: [], whitelist: [] };

    // sys!config channel list
    if (!action || action === 'list') {
        const blacklist = guild.channels.blacklist || [];
        const whitelist = guild.channels.whitelist || [];
        
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.info)
            .setTitle('📝 Channel Settings');

        if (whitelist.length > 0) {
            embed.setDescription('**Mode: Whitelist** (only listed channels allow proxying)');
            embed.addFields({
                name: `Whitelisted Channels (${whitelist.length})`,
                value: whitelist.map(id => `<#${id}>`).join('\n') || '*None*'
            });
        } else if (blacklist.length > 0) {
            embed.setDescription('**Mode: Blacklist** (listed channels block proxying)');
            embed.addFields({
                name: `Blacklisted Channels (${blacklist.length})`,
                value: blacklist.map(id => `<#${id}>`).join('\n') || '*None*'
            });
        } else {
            embed.setDescription('**Mode: Open** (all channels allow proxying)');
        }

        return message.reply({ embeds: [embed] });
    }

    // sys!config channel clear
    if (action === 'clear') {
        guild.channels.blacklist = [];
        guild.channels.whitelist = [];
        await guild.save();
        return utils.success(message, 'Channel restrictions cleared. All channels now allow proxying.');
    }

    // Get channel from mention or ID
    const channelMention = message.mentions.channels.first();
    const channelId = channelMention?.id || parsed._positional[2];
    
    if (!channelId && ['blacklist', 'whitelist', 'remove', 'add'].includes(action)) {
        return utils.error(message, 'Please mention a channel or provide a channel ID.');
    }

    // Validate channel exists
    if (channelId) {
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
            return utils.error(message, 'Channel not found.');
        }
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            return utils.error(message, 'Only text channels can be added to the list.');
        }
    }

    // sys!config channel blacklist <#channel>
    if (action === 'blacklist' || action === 'black' || action === 'bl') {
        // If whitelist is active, inform user
        if (guild.channels.whitelist.length > 0) {
            return utils.error(message, 'Whitelist mode is active. Use `sys!config channel clear` first, or use `sys!config channel remove` to remove from whitelist.');
        }
        
        if (guild.channels.blacklist.includes(channelId)) {
            return utils.error(message, 'Channel is already blacklisted.');
        }
        
        guild.channels.blacklist.push(channelId);
        await guild.save();
        return utils.success(message, `<#${channelId}> has been **blacklisted**. Proxying is disabled there.`);
    }

    // sys!config channel whitelist <#channel>
    if (action === 'whitelist' || action === 'white' || action === 'wl') {
        // If blacklist has items and whitelist is empty, warn about mode switch
        if (guild.channels.blacklist.length > 0 && guild.channels.whitelist.length === 0) {
            // Clear blacklist when switching to whitelist mode
            guild.channels.blacklist = [];
        }
        
        if (guild.channels.whitelist.includes(channelId)) {
            return utils.error(message, 'Channel is already whitelisted.');
        }
        
        guild.channels.whitelist.push(channelId);
        await guild.save();
        return utils.success(message, `<#${channelId}> has been **whitelisted**. Proxying is now ONLY allowed in whitelisted channels.`);
    }

    // sys!config channel remove <#channel>
    if (action === 'remove' || action === 'rm') {
        let removed = false;
        
        const blackIdx = guild.channels.blacklist.indexOf(channelId);
        if (blackIdx !== -1) {
            guild.channels.blacklist.splice(blackIdx, 1);
            removed = true;
        }
        
        const whiteIdx = guild.channels.whitelist.indexOf(channelId);
        if (whiteIdx !== -1) {
            guild.channels.whitelist.splice(whiteIdx, 1);
            removed = true;
        }
        
        if (!removed) {
            return utils.error(message, 'Channel is not in any list.');
        }
        
        await guild.save();
        return utils.success(message, `<#${channelId}> has been removed from channel restrictions.`);
    }

    return utils.error(message, 'Unknown channel action. Use `blacklist`, `whitelist`, `remove`, `clear`, or `list`.');
}

/**
 * Handle logging settings
 */
async function handleLog(message, parsed, guild) {
    const action = parsed._positional[1]?.toLowerCase();
    
    guild.channels = guild.channels || { logEvents: {} };

    // sys!config log (show current)
    if (!action) {
        const logChannel = guild.channels.logChannel;
        if (!logChannel) {
            return utils.info(message, 'Logging is currently **disabled**.\nUse `sys!config log #channel` to enable.');
        }
        
        const events = guild.channels.logEvents || {};
        const enabledEvents = [];
        if (events.proxy !== false) enabledEvents.push('proxy');
        if (events.edit) enabledEvents.push('edit');
        if (events.delete) enabledEvents.push('delete');
        
        return utils.info(message, `Logging to <#${logChannel}>\n**Events:** ${enabledEvents.join(', ') || 'none'}`);
    }

    // sys!config log off
    if (action === 'off' || action === 'disable' || action === 'none') {
        guild.channels.logChannel = undefined;
        await guild.save();
        return utils.success(message, 'Proxy logging has been **disabled**.');
    }

    // sys!config log events <event> <on|off>
    if (action === 'events' || action === 'event') {
        const eventName = parsed._positional[2]?.toLowerCase();
        const eventValue = parsed._positional[3]?.toLowerCase();
        
        if (!eventName || !['proxy', 'edit', 'delete'].includes(eventName)) {
            return utils.error(message, 'Valid events: `proxy`, `edit`, `delete`\nUsage: `sys!config log events <event> <on|off>`');
        }
        
        if (!eventValue || !['on', 'off'].includes(eventValue)) {
            const current = guild.channels.logEvents?.[eventName] ? 'on' : 'off';
            return utils.info(message, `Event **${eventName}** is currently **${current}**.\nUse \`sys!config log events ${eventName} on\` or \`off\` to change.`);
        }
        
        guild.channels.logEvents = guild.channels.logEvents || {};
        guild.channels.logEvents[eventName] = eventValue === 'on';
        await guild.save();
        
        return utils.success(message, `Log event **${eventName}** is now **${eventValue}**.`);
    }

    // sys!config log #channel
    const channelMention = message.mentions.channels.first();
    const channelId = channelMention?.id || action;
    
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
        return utils.error(message, 'Channel not found. Please mention a channel or provide a valid ID.');
    }
    
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return utils.error(message, 'Log channel must be a text channel.');
    }

    guild.channels.logChannel = channelId;
    // Set default log events if not set
    guild.channels.logEvents = guild.channels.logEvents || { proxy: true, edit: false, delete: false };
    await guild.save();

    return utils.success(message, `Proxy events will now be logged to <#${channelId}>.`);
}

/**
 * Handle admin management
 */
async function handleAdmin(message, parsed, guild) {
    const action = parsed._positional[1]?.toLowerCase();
    
    guild.admins = guild.admins || { roleIDs: [], memberIDs: [] };

    // sys!config admin list (or just sys!config admin)
    if (!action || action === 'list') {
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.info)
            .setTitle('👑 Systemiser Admins');

        const roles = guild.admins.roleIDs || [];
        const members = guild.admins.memberIDs || [];

        embed.addFields(
            {
                name: `Roles (${roles.length})`,
                value: roles.length ? roles.map(id => `<@&${id}>`).join('\n') : '*None*',
                inline: true
            },
            {
                name: `Members (${members.length})`,
                value: members.length ? members.map(id => `<@${id}>`).join('\n') : '*None*',
                inline: true
            }
        );

        embed.setFooter({ text: 'Note: Users with Manage Server permission always have access' });

        return message.reply({ embeds: [embed] });
    }

    // sys!config admin add <@role|@user>
    if (action === 'add') {
        const role = message.mentions.roles.first();
        const user = message.mentions.users.first();
        
        if (!role && !user) {
            return utils.error(message, 'Please mention a role or user to add as admin.');
        }

        if (role) {
            if (guild.admins.roleIDs.includes(role.id)) {
                return utils.error(message, 'Role is already an admin.');
            }
            guild.admins.roleIDs.push(role.id);
            await guild.save();
            return utils.success(message, `<@&${role.id}> has been added as a Systemiser admin.`);
        }

        if (user) {
            if (guild.admins.memberIDs.includes(user.id)) {
                return utils.error(message, 'User is already an admin.');
            }
            guild.admins.memberIDs.push(user.id);
            await guild.save();
            return utils.success(message, `<@${user.id}> has been added as a Systemiser admin.`);
        }
    }

    // sys!config admin remove <@role|@user>
    if (action === 'remove' || action === 'rm') {
        const role = message.mentions.roles.first();
        const user = message.mentions.users.first();
        
        if (!role && !user) {
            return utils.error(message, 'Please mention a role or user to remove.');
        }

        if (role) {
            const idx = guild.admins.roleIDs.indexOf(role.id);
            if (idx === -1) {
                return utils.error(message, 'Role is not an admin.');
            }
            guild.admins.roleIDs.splice(idx, 1);
            await guild.save();
            return utils.success(message, `<@&${role.id}> has been removed from Systemiser admins.`);
        }

        if (user) {
            const idx = guild.admins.memberIDs.indexOf(user.id);
            if (idx === -1) {
                return utils.error(message, 'User is not an admin.');
            }
            guild.admins.memberIDs.splice(idx, 1);
            await guild.save();
            return utils.success(message, `<@${user.id}> has been removed from Systemiser admins.`);
        }
    }

    return utils.error(message, 'Unknown admin action. Use `add`, `remove`, or `list`.');
}

/**
 * Show help for config command
 */
async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('⚙️ Server Config Commands')
        .setDescription('Configure Systemiser for this server.\n*Requires Manage Server permission or Systemiser admin role.*')
        .addFields(
            {
                name: '🔧 General',
                value: [
                    '`sys!config` - Show current settings',
                    '`sys!config proxy <on|off>` - Enable/disable proxying',
                    '`sys!config autoproxy <on|off>` - Allow/force-disable autoproxy',
                    '`sys!config closedchar <on|off>` - Allow/restrict special characters'
                ].join('\n'),
                inline: false
            },
            {
                name: '📝 Channels',
                value: [
                    '`sys!config channel list` - Show channel restrictions',
                    '`sys!config channel blacklist #channel` - Block proxying in channel',
                    '`sys!config channel whitelist #channel` - Only allow in channel',
                    '`sys!config channel remove #channel` - Remove from list',
                    '`sys!config channel clear` - Clear all restrictions'
                ].join('\n'),
                inline: false
            },
            {
                name: '📋 Logging',
                value: [
                    '`sys!config log #channel` - Set log channel',
                    '`sys!config log off` - Disable logging',
                    '`sys!config log events <proxy|edit|delete> <on|off>`'
                ].join('\n'),
                inline: false
            },
            {
                name: '👑 Admins',
                value: [
                    '`sys!config admin list` - List bot admins',
                    '`sys!config admin add @role|@user` - Add admin',
                    '`sys!config admin remove @role|@user` - Remove admin'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Whitelist mode overrides blacklist. Clear to switch modes.' });

    return message.reply({ embeds: [embed] });
}