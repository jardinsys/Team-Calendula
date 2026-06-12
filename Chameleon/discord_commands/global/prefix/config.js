// sys!config / sys!settings - Personal system configuration
// Aliases: sys!config, sys!cfg, sys!settings
//
// USAGE:
//   sys!config                                    - Show current personal settings
//   sys!config timezone [tz]                      - Set/view timezone
//   sys!config proxy style <off|last|front|name>  - Set proxy style
//   sys!config proxy case <on|off>                - Toggle case sensitivity
//   sys!config proxy cooldown <seconds|off|reset> - Set proxy cooldown
//   sys!config proxy break <on|off>               - Toggle proxy break
//   sys!config proxy layout <alter|state|group> <format> - Set proxy layout
//   sys!config proxy server <guild> <style>       - Set per-server proxy style
//   sys!config closedchar <on|off>                - Toggle special characters
//   sys!config name format <format>               - Set name format
//   sys!config terminology alter <singular> [plural] - Set alter terminology
//   sys!config pronounseparator <sep|off>         - Set pronoun separator
//   sys!config autoshare <on|off>                 - Toggle auto-share notes
//   sys!config sync <on|off>                      - Toggle Discord sync
//   sys!config notifications friend|request|switch|message <on|off>
//   sys!config friendbucket <bucket|off>          - Set friend auto-bucket
//   sys!config help                               - Show help

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');

const { getSystemTerm, getAlterTerm } = utils;

module.exports = {
    name: 'config',
    aliases: ['cfg', 'settings'],

    async executeMessage(message, args) {
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(message);
        if (isNew) return await utils.handleNewUserFlow(message, 'config');

        const parsed = utils.parseArgs(args);
        const subcommand = parsed._positional[0]?.toLowerCase();

        const handlers = {
            'timezone': () => handleTimezone(message, parsed, system),
            'tz': () => handleTimezone(message, parsed, system),
            'proxy': () => handleProxy(message, parsed, user, system),
            'closedchar': () => handleClosedChar(message, parsed, user),
            'closed': () => handleClosedChar(message, parsed, user),
            'name': () => handleName(message, parsed, system),
            'terminology': () => handleTerminology(message, parsed, system),
            'term': () => handleTerminology(message, parsed, system),
            'pronounseparator': () => handlePronounSeparator(message, parsed, system),
            'pronounsep': () => handlePronounSeparator(message, parsed, system),
            'autoshare': () => handleAutoshare(message, parsed, system),
            'sync': () => handleSync(message, parsed, system),
            'notifications': () => handleNotifications(message, parsed, user),
            'notif': () => handleNotifications(message, parsed, user),
            'friendbucket': () => handleFriendBucket(message, parsed, system),
            'ping': () => handlePing(message, parsed, user),
            'autoattribution': () => handleAutoAttribution(message, parsed, system),
            'attributionstyle': () => handleAttributionStyle(message, parsed, user),
            'help': () => handleHelp(message)
        };

        if (!subcommand || !handlers[subcommand])
            return handleShow(message, user, system);

        return handlers[subcommand]();
    }
};

async function handleShow(message, user, system) {
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('⚙️ Personal Settings')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    if (system) {
        embed.addFields({
            name: '🎭 Proxy Settings',
            value: [
                `**Style:** \`${system.proxy?.style || 'off'}\``,
                `**Reply Style:** \`${system.proxy?.replyStyle || 'embed'}\``,
                `**Case Sensitive:** ${system.proxy?.caseSensitive ? '✅ Yes' : '❌ No'}`,
                `**Cooldown:** ${system.setting?.proxyCoolDown || 3600} seconds`,
                `**Break:** ${system.proxy?.break ? '⛔ Enabled' : '▶️ Disabled'}`
            ].join('\n'),
            inline: false
        });

        embed.addFields({
            name: '🌐 General',
            value: [
                `**Timezone:** ${system.timezone || '*Not set*'}`,
                `**Terminology:** ${getSystemTerm(system)} / ${getAlterTerm(system, {plural:true}).charAt(0).toUpperCase() + getAlterTerm(system, {plural:true}).slice(1)} / ${getAlterTerm(system, {plural:true})}`,
                `**Pronoun Separator:** ${system.discord?.pronounSeparator || '*Not set*'}`,
                `**Discord Sync:** ${system.syncWithApps?.discord ? '✅ Enabled' : '❌ Disabled'}`,
                `**Auto-share Notes:** ${system.setting?.autoshareNotestoUsers ? '✅ Enabled' : '❌ Disabled'}`,
                `**Friend Auto-Bucket:** ${system.setting?.friendAutoBucket || '*Not set*'}`,
                `**Note Auto-Attribution:** ${{ topLayer: 'Top Layer', allFronters: 'All Fronters', off: 'Off' }[system.setting?.noteAutoAttribution || 'topLayer']}`
            ].join('\n'),
            inline: false
        });

        if (system.discord?.tag?.normal?.length > 0) {
            embed.addFields({
                name: '🏷️ Proxy Tags',
                value: system.discord.tag.normal.map(t => '`' + t + '`').join(', '),
                inline: false
            });
        }
    }

    if (user) {
        const notifPrefs = user.settings?.notificationPreferences || {};
        embed.addFields({
            name: '🔔 Notifications',
            value: [
                `**Friend Notifications:** ${notifPrefs.friendNotifications || 'dm'}`,
                `**Friend Requests:** ${notifPrefs.friendRequests !== false ? '✅' : '❌'}`,
                `**Friend Switches:** ${notifPrefs.friendSwitches !== false ? '✅' : '❌'}`,
                `**App Messages:** ${notifPrefs.appMessages !== false ? '✅' : '❌'}`
            ].join('\n'),
            inline: false
        });

        embed.addFields({
            name: '🔤 Display',
            value: [
                `**Special Characters:** ${user.settings?.closedCharAllowed !== false ? '✅ Allowed' : '❌ Restricted'}`,
                `**Attribution Display:** ${user.settings?.noteAttributionStyle === 'entityOnly' ? 'Entity Only' : 'Entity + User'}`
            ].join('\n'),
            inline: false
        });

        embed.addFields({
            name: '📢 Pings',
            value: `**Message Pings:** ${user.settings?.allowPing !== false ? '✅ Enabled' : '❌ Disabled'}`,
            inline: false
        });
    }

    embed.setFooter({ text: 'Use sys!config help for command list' });

    return message.reply({ embeds: [embed] });
}

async function handleTimezone(message, parsed, system) {
    const value = parsed._positional.slice(1).join(' ');

    if (!value) {
        const current = system.timezone || '*Not set*';
        return utils.info(message, `Your timezone is currently **${current}**.\nUse \`sys!config timezone <timezone>\` to change (e.g., \`sys!config timezone America/New_York\`).`);
    }

    system.timezone = value;
    await system.save();

    return utils.success(message, `Timezone set to **${value}**.`);
}

async function handleProxy(message, parsed, user, system) {
    if (!system) return utils.error(message, 'You need a system to configure proxy settings.');

    const action = parsed._positional[1]?.toLowerCase();

    if (!action) {
        return utils.info(message, [
            `**Style:** \`${system.proxy?.style || 'off'}\``,
            `**Reply Style:** \`${system.proxy?.replyStyle || 'embed'}\``,
            `**Case Sensitive:** ${system.proxy?.caseSensitive ? 'Yes' : 'No'}`,
            `**Cooldown:** ${system.setting?.proxyCoolDown || 3600}s`,
            `**Break:** ${system.proxy?.break ? 'Enabled' : 'Disabled'}`,
            '',
            'Use `sys!config help` for proxy subcommands.'
        ].join('\n'));
    }

    const handlers = {
        'style': () => handleProxyStyle(message, parsed, system),
        'case': () => handleProxyCase(message, parsed, system),
        'cooldown': () => handleProxyCooldown(message, parsed, system),
        'break': () => handleProxyBreak(message, parsed, system),
        'layout': () => handleProxyLayout(message, parsed, system),
        'server': () => handleProxyServer(message, parsed, system),
        'replystyle': () => handleProxyReplyStyle(message, parsed, system)
    };

    if (!handlers[action])
        return utils.error(message, 'Unknown proxy action. Use `style`, `case`, `cooldown`, `break`, `layout`, `server`, or `replystyle`.');

    return handlers[action]();
}

async function handleProxyStyle(message, parsed, system) {
    const value = parsed._positional[2]?.toLowerCase();

    if (!value) {
        return utils.info(message, `Current proxy style: \`${system.proxy?.style || 'off'}\`\nUse \`sys!config proxy style <off|last|front|state|name>\` to change.`);
    }

    const validStyles = ['off', 'last', 'front', 'state'];
    if (!validStyles.includes(value)) {
        system.proxy = system.proxy || {};
        system.proxy.style = value;
        await system.save();
        return utils.success(message, `Proxy style set to **${value}** (specific entity).`);
    }

    system.proxy = system.proxy || {};
    system.proxy.style = value;
    await system.save();

    if (value === 'off') return utils.success(message, 'Auto-proxy is now **disabled**. Use proxy tags to proxy.');
    if (value === 'last') return utils.success(message, 'Proxy style set to **last**. Will auto-proxy your most recent entity.');
    if (value === 'front') return utils.success(message, 'Proxy style set to **front**. Will auto-proxy your current fronter.');
    if (value === 'state') return utils.success(message, 'Proxy style set to **state**. Will auto-proxy as the fronting state entity.');
}

async function handleProxyCase(message, parsed, system) {
    const value = parsed._positional[2]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = system.proxy?.caseSensitive ? 'enabled' : 'disabled';
        return utils.info(message, `Case sensitivity is currently **${current}**.\nUse \`sys!config proxy case on\` or \`sys!config proxy case off\` to change.`);
    }

    const enable = value === 'on';
    system.proxy = system.proxy || {};
    system.proxy.caseSensitive = enable;
    await system.save();

    return utils.success(message, `Proxy tags are now **${enable ? 'case sensitive' : 'case insensitive'}**.`);
}

async function handleProxyCooldown(message, parsed, system) {
    const value = parsed._positional[2]?.toLowerCase();

    if (!value) {
        const current = system.setting?.proxyCoolDown || 3600;
        return utils.info(message, `Proxy cooldown is currently **${current} seconds**.\nUse \`sys!config proxy cooldown <seconds>\`, \`off\`, or \`reset\` to change.`);
    }

    if (value === 'off' || value === '0') {
        system.setting = system.setting || {};
        system.setting.proxyCoolDown = 0;
        await system.save();
        return utils.success(message, 'Proxy cooldown is now **disabled**.');
    }

    if (value === 'reset' || value === 'default') {
        system.setting = system.setting || {};
        system.setting.proxyCoolDown = 3600;
        await system.save();
        return utils.success(message, 'Proxy cooldown reset to **3600 seconds** (1 hour).');
    }

    const seconds = parseInt(value);
    if (isNaN(seconds) || seconds < 0) {
        return utils.error(message, 'Please provide a valid number of seconds, `off`, or `reset`.');
    }

    system.setting = system.setting || {};
    system.setting.proxyCoolDown = seconds;
    await system.save();

    return utils.success(message, `Proxy cooldown set to **${seconds} seconds**.`);
}

async function handleProxyBreak(message, parsed, system) {
    const value = parsed._positional[2]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = system.proxy?.break ? 'enabled' : 'disabled';
        return utils.info(message, `Proxy break is currently **${current}**.\nUse \`sys!config proxy break on\` or \`sys!config proxy break off\` to change.`);
    }

    const enable = value === 'on';
    system.proxy = system.proxy || {};
    system.proxy.break = enable;
    await system.save();

    if (enable) return utils.success(message, 'Proxy break is now **enabled**. Use `\\` to break out of a proxy.');
    return utils.success(message, 'Proxy break is now **disabled**.');
}

async function handleProxyLayout(message, parsed, system) {
    const type = parsed._positional[2]?.toLowerCase();
    const format = parsed._positional.slice(3).join(' ');

    if (!type || !['alter', 'state', 'group'].includes(type)) {
        const layouts = system.discord?.proxylayout || {};
        return utils.info(message, [
            '**Current Layouts:**',
            `**Alter:** ${layouts.alter || '*Not set*'}`,
            `**State:** ${layouts.state || '*Not set*'}`,
            `**Group:** ${layouts.group || '*Not set*'}`,
            '',
            'Use `sys!config proxy layout <alter|state|group> <format>` to change.'
        ].join('\n'));
    }

    if (!format) {
        const current = system.discord?.proxylayout?.[type] || '*Not set*';
        return utils.info(message, `Current ${type} layout: ${current}\nUse \`sys!config proxy layout ${type} <format>\` to change.`);
    }

    system.discord = system.discord || {};
    system.discord.proxylayout = system.discord.proxylayout || {};
    system.discord.proxylayout[type] = format;
    await system.save();

    return utils.success(message, `${utils.capitalize(type)} layout set to: \`${format}\``);
}

async function handleProxyServer(message, parsed, system) {
    const guildName = parsed._positional[2];
    const style = parsed._positional[3]?.toLowerCase();

    const servers = system.discord?.server || [];

    if (!guildName) {
        if (servers.length === 0) {
            return utils.info(message, 'No per-server proxy styles configured.\nUse `sys!config proxy server <guild> <style>` to set one.');
        }

        const list = servers
            .filter(s => s.proxyStyle && s.proxyStyle !== 'off')
            .map(s => `**${s.name}:** \`${s.proxyStyle}\``)
            .join('\n') || '*No custom styles set*';

        const replyList = servers
            .filter(s => s.replyStyle)
            .map(s => `**${s.name}:** \`${s.replyStyle}\``)
            .join('\n') || '*No custom reply styles set*';

        return utils.info(message, `**Per-Server Proxy Styles:**\n${list}\n\n**Per-Server Reply Styles:**\n${replyList}`);
    }

    const server = servers.find(s => s.name.toLowerCase() === guildName.toLowerCase() || s.id === guildName);
    if (!server) {
        return utils.error(message, `Server "${guildName}" not found. Make sure you've set up this server in your system.`);
    }

    if (!style) {
        return utils.info(message, `**${server.name}:**\nProxy Style: \`${server.proxyStyle || 'off'}\`\nReply Style: \`${server.replyStyle || 'default'}\`\n\nUse \`sys!config proxy server ${server.name} <style>\` to change proxy style.\nUse \`sys!config proxy server ${server.name} replystyle <embed|native|default>\` to change reply style.`);
    }

    if (style === 'replystyle') {
        const replyValue = parsed._positional[4]?.toLowerCase();
        if (!replyValue) {
            return utils.info(message, `Current reply style for **${server.name}:** \`${server.replyStyle || 'default'}\`\nUse \`sys!config proxy server ${server.name} replystyle <embed|native|default>\` to change.`);
        }
        if (!['embed', 'native', 'default'].includes(replyValue)) {
            return utils.error(message, 'Invalid reply style. Use `embed`, `native`, or `default`.');
        }
        if (replyValue === 'default') {
            delete server.replyStyle;
        } else {
            server.replyStyle = replyValue;
        }
        await system.save();
        return utils.success(message, `Reply style for **${server.name}** set to \`${replyValue}\`.`);
    }

    server.proxyStyle = style;
    await system.save();

    return utils.success(message, `Proxy style for **${server.name}** set to \`${style}\`.`);
}

async function handleProxyReplyStyle(message, parsed, system) {
    const value = parsed._positional[2]?.toLowerCase();

    if (!value) {
        return utils.info(message, `Current reply style: \`${system.proxy?.replyStyle || 'embed'}\`\nUse \`sys!config proxy replystyle <embed|native>\` to change.`);
    }

    if (!['embed', 'native'].includes(value)) {
        return utils.error(message, 'Invalid reply style. Use `embed` or `native`.');
    }

    system.proxy = system.proxy || {};
    system.proxy.replyStyle = value;
    await system.save();

    if (value === 'embed') return utils.success(message, 'Reply style set to **embed**. Proxied replies will use a custom embed.');
    if (value === 'native') return utils.success(message, 'Reply style set to **native**. Proxied replies will use Discord\'s built-in reply feature.');
}

async function handleClosedChar(message, parsed, user) {
    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = user.settings?.closedCharAllowed !== false ? 'allowed' : 'restricted';
        return utils.info(message, `Special characters are currently **${current}**.\nUse \`sys!config closedchar on\` or \`sys!config closedchar off\` to change.`);
    }

    const allow = value === 'on';
    user.settings = user.settings || {};
    user.settings.closedCharAllowed = allow;
    await user.save();

    if (allow) return utils.success(message, 'Special characters are now **allowed** in your proxy names.');
    return utils.success(message, 'Special characters are now **restricted**. Your `closedNameDisplay` will be used instead.');
}

async function handleName(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure name settings.');

    const action = parsed._positional[1]?.toLowerCase();

    if (action !== 'format') {
        const current = system.discord?.name?.display || '*Not set*';
        return utils.info(message, `Current name format: ${current}\nUse \`sys!config name format <format>\` to change.`);
    }

    const format = parsed._positional.slice(2).join(' ');
    if (!format) {
        return utils.error(message, 'Please provide a format. Example: `sys!config name format {name} | {system}`');
    }

    system.discord = system.discord || {};
    system.discord.name = system.discord.name || {};
    system.discord.name.display = format;
    await system.save();

    return utils.success(message, `Name format set to: \`${format}\``);
}

async function handleTerminology(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure terminology.');

    const type = parsed._positional[1]?.toLowerCase();

    if (type !== 'alter') {
        const sysTerm = getSystemTerm(system);
        const alterSing = getAlterTerm(system);
        const alterPlural = getAlterTerm(system, {plural:true});
        return utils.info(message, `Current terminology: **${sysTerm}** / **${alterSing}** / **${alterPlural}**\nUse \`sys!config terminology alter <singular> [plural]\` to change alter terms.`);
    }

    const singular = parsed._positional[2];
    const plural = parsed._positional[3] || singular + 's';

    if (!singular) {
        return utils.error(message, 'Please provide the singular form. Example: `sys!config terminology alter member`');
    }

    system.alterSynonym = { singular, plural };
    await system.save();

    return utils.success(message, `Terminology set to **${singular}** / **${plural}**.`);
}

async function handlePronounSeparator(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure pronoun separator.');

    const value = parsed._positional.slice(1).join(' ');

    if (!value) {
        const current = system.discord?.pronounSeparator || '*Not set*';
        return utils.info(message, `Current pronoun separator: ${current}\nUse \`sys!config pronounseparator <separator>\` or \`off\` to change.`);
    }

    if (value.toLowerCase() === 'off' || value.toLowerCase() === 'none') {
        system.discord = system.discord || {};
        system.discord.pronounSeparator = undefined;
        await system.save();
        return utils.success(message, 'Pronoun separator has been **disabled**.');
    }

    system.discord = system.discord || {};
    system.discord.pronounSeparator = value;
    await system.save();

    return utils.success(message, `Pronoun separator set to: \`${value}\``);
}

async function handleAutoshare(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure auto-share.');

    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = system.setting?.autoshareNotestoUsers ? 'enabled' : 'disabled';
        return utils.info(message, `Auto-share notes is currently **${current}**.\nUse \`sys!config autoshare on\` or \`sys!config autoshare off\` to change.`);
    }

    const enable = value === 'on';
    system.setting = system.setting || {};
    system.setting.autoshareNotestoUsers = enable;
    await system.save();

    return utils.success(message, `Auto-share notes is now **${enable ? 'enabled' : 'disabled'}**.`);
}

async function handleSync(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure sync.');

    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = system.syncWithApps?.discord ? 'enabled' : 'disabled';
        return utils.info(message, `Discord sync is currently **${current}**.\nUse \`sys!config sync on\` or \`sys!config sync off\` to change.`);
    }

    const enable = value === 'on';
    system.syncWithApps = system.syncWithApps || {};
    system.syncWithApps.discord = enable;
    await system.save();

    return utils.success(message, `Discord sync is now **${enable ? 'enabled' : 'disabled'}**.`);
}

async function handleNotifications(message, parsed, user) {
    const type = parsed._positional[1]?.toLowerCase();
    const value = parsed._positional[2]?.toLowerCase();

    const prefs = user.settings?.notificationPreferences || {};

    if (!type) {
        return utils.info(message, [
            '**Current Notification Settings:**',
            `**Friend Notifications:** ${prefs.friendNotifications || 'dm'}`,
            `**Friend Requests:** ${prefs.friendRequests !== false ? '✅ Enabled' : '❌ Disabled'}`,
            `**Friend Switches:** ${prefs.friendSwitches !== false ? '✅ Enabled' : '❌ Disabled'}`,
            `**App Messages:** ${prefs.appMessages !== false ? '✅ Enabled' : '❌ Disabled'}`,
            '',
            'Use `sys!config notifications <type> <on|off>` to change.'
        ].join('\n'));
    }

    user.settings = user.settings || {};
    user.settings.notificationPreferences = user.settings.notificationPreferences || {};

    if (type === 'friend') {
        if (!value || !['dm', 'command', 'off', 'none'].includes(value)) {
            const current = prefs.friendNotifications || 'dm';
            return utils.info(message, `Friend notifications are currently **${current}**.\nUse \`sys!config notifications friend <dm|command|off>\` to change.`);
        }

        const setting = value === 'off' || value === 'none' ? 'none' : value;
        user.settings.notificationPreferences.friendNotifications = setting;
        await user.save();

        return utils.success(message, `Friend notifications set to **${setting}**.`);
    }

    if (type === 'request' || type === 'requests') {
        if (!value || !['on', 'off'].includes(value)) {
            const current = prefs.friendRequests !== false ? 'enabled' : 'disabled';
            return utils.info(message, `Friend request notifications are currently **${current}**.\nUse \`sys!config notifications request on\` or \`off\` to change.`);
        }

        user.settings.notificationPreferences.friendRequests = value === 'on';
        await user.save();

        return utils.success(message, `Friend request notifications are now **${value === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (type === 'switch' || type === 'switches') {
        if (!value || !['on', 'off'].includes(value)) {
            const current = prefs.friendSwitches !== false ? 'enabled' : 'disabled';
            return utils.info(message, `Friend switch notifications are currently **${current}**.\nUse \`sys!config notifications switch on\` or \`off\` to change.`);
        }

        user.settings.notificationPreferences.friendSwitches = value === 'on';
        await user.save();

        return utils.success(message, `Friend switch notifications are now **${value === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (type === 'message' || type === 'messages' || type === 'app') {
        if (!value || !['on', 'off'].includes(value)) {
            const current = prefs.appMessages !== false ? 'enabled' : 'disabled';
            return utils.info(message, `App message notifications are currently **${current}**.\nUse \`sys!config notifications message on\` or \`off\` to change.`);
        }

        user.settings.notificationPreferences.appMessages = value === 'on';
        await user.save();

        return utils.success(message, `App message notifications are now **${value === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    return utils.error(message, 'Unknown notification type. Use `friend`, `request`, `switch`, or `message`.');
}

async function handleFriendBucket(message, parsed, system) {
    if (!system) return utils.error(message, 'You need a system to configure friend auto-bucket.');

    const value = parsed._positional.slice(1).join(' ');

    if (!value) {
        const current = system.setting?.friendAutoBucket || '*Not set*';
        return utils.info(message, `Friend auto-bucket is currently **${current}**.\nUse \`sys!config friendbucket <bucket>\` or \`off\` to change.`);
    }

    if (value.toLowerCase() === 'off' || value.toLowerCase() === 'none') {
        system.setting = system.setting || {};
        system.setting.friendAutoBucket = undefined;
        await system.save();
        return utils.success(message, 'Friend auto-bucket has been **disabled**.');
    }

    system.setting = system.setting || {};
    system.setting.friendAutoBucket = value;
    await system.save();

    return utils.success(message, `Friend auto-bucket set to **${value}**.`);
}

async function handlePing(message, parsed, user) {
    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !['on', 'off'].includes(value)) {
        const current = user.settings?.allowPing !== false ? 'enabled' : 'disabled';
        return utils.info(message, `Message pings are currently **${current}**.\nUse \`sys!config ping on\` or \`sys!config ping off\` to change.`);
    }

    const enable = value === 'on';
    user.settings = user.settings || {};
    user.settings.allowPing = enable;
    await user.save();

    return utils.success(message, `Message pings are now **${enable ? 'enabled' : 'disabled'}**.`);
}

const AUTO_ATTRIBUTION_OPTIONS = ['topLayer', 'allFronters', 'off'];
const AUTO_ATTRIBUTION_LABELS = { topLayer: 'Top Layer', allFronters: 'All Fronters', off: 'Off' };

async function handleAutoAttribution(message, parsed, system) {
    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !AUTO_ATTRIBUTION_OPTIONS.includes(value)) {
        const current = system?.setting?.noteAutoAttribution || 'topLayer';
        return utils.info(message, `Note auto-attribution is currently **${AUTO_ATTRIBUTION_LABELS[current]}**.\nUse \`sys!config autoattribution <topLayer|allFronters|off>\` to change.`);
    }

    system.setting = system.setting || {};
    system.setting.noteAutoAttribution = value;
    await system.save();

    return utils.success(message, `Note auto-attribution set to **${AUTO_ATTRIBUTION_LABELS[value]}**.`);
}

async function handleAttributionStyle(message, parsed, user) {
    const value = parsed._positional[1]?.toLowerCase();

    if (!value || !['entityanduser', 'entityonly'].includes(value)) {
        const current = user.settings?.noteAttributionStyle === 'entityOnly' ? 'entityonly' : 'entityanduser';
        return utils.info(message, `Attribution display is currently **${current === 'entityonly' ? 'Entity Only' : 'Entity + User'}**.\nUse \`sys!config attributionstyle <entityAndUser|entityOnly>\` to change.`);
    }

    user.settings = user.settings || {};
    user.settings.noteAttributionStyle = value === 'entityonly' ? 'entityOnly' : 'entityAndUser';
    await user.save();

    return utils.success(message, `Attribution display set to **${value === 'entityonly' ? 'Entity Only' : 'Entity + User'}**.`);
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('⚙️ Personal Config Commands')
        .setDescription('Configure your personal Systemiser settings.')
        .addFields(
            {
                name: '🎭 Proxy',
                value: [
                    '`sys!config proxy style <off|last|front|state|name>`',
                    '`sys!config proxy replystyle <embed|native>`',
                    '`sys!config proxy case <on|off>`',
                    '`sys!config proxy cooldown <seconds|off|reset>`',
                    '`sys!config proxy break <on|off>`',
                    '`sys!config proxy layout <alter|state|group> <format>`',
                    '`sys!config proxy server <guild> <style>`',
                    '`sys!config proxy server <guild> replystyle <embed|native|default>`'
                ].join('\n'),
                inline: false
            },
            {
                name: '🌐 General',
                value: [
                    '`sys!config timezone <tz>` - Set timezone',
                    '`sys!config name format <format>` - Set name format',
                    '`sys!config terminology alter <singular> [plural]`',
                    '`sys!config pronounseparator <sep|off>`',
                    '`sys!config autoshare <on|off>`',
                    '`sys!config sync <on|off>`',
                    '`sys!config friendbucket <bucket|off>`'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔔 Notifications',
                value: [
                    '`sys!config notifications friend <dm|command|off>`',
                    '`sys!config notifications request <on|off>`',
                    '`sys!config notifications switch <on|off>`',
                    '`sys!config notifications message <on|off>`'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔤 Display',
                value: '`sys!config closedchar <on|off>` - Toggle special characters',
                inline: false
            },
            {
                name: '📢 Pings',
                value: '`sys!config ping <on|off>` - Toggle message pings',
                inline: false
            },
            {
                name: '🏷️ Attribution',
                value: [
                    '`sys!config autoattribution <topLayer|allFronters|off>`',
                    '`sys!config attributionstyle <entityAndUser|entityOnly>`'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'For server settings, use sys!serverconfig' });

    return message.reply({ embeds: [embed] });
}
