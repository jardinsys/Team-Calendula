// (/settings) - Unified Settings Command
// Sections: Server, Proxy, Notifications, General

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
    StringSelectMenuOptionBuilder,
    PermissionsBitField,
    ChannelType
} = require('discord.js');

const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Guild = require('../../../schemas/guild');
const utils = require('../../functions/bot_utils');

const SETTINGS_COLOR = '#808080';

const { getSystemTerm, getAlterTerm } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Profile and server settings')
        .addStringOption(option =>
            option.setName('section')
                .setDescription('Settings section to open')
                .setRequired(false)
                .addChoices(
                    { name: 'Server Settings', value: 'server' },
                    { name: 'Proxy Settings', value: 'proxy' },
                    { name: 'Notification Settings', value: 'notifications' },
                    { name: 'General Settings', value: 'general' }
                )),

    async execute(interaction) {
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);
        if (isNew) return await utils.handleNewUserFlow(interaction, 'settings');

        const section = interaction.options.getString('section');
        const sessionId = utils.generateSessionId(interaction.user.id);

        utils.setSession(sessionId, {
            type: 'settings',
            userId: user._id.toString(),
            systemId: system?._id?.toString() || null
        });

        switch (section) {
            case 'server':
                return await handleServerSection(interaction, user, system, sessionId);
            case 'proxy':
                if (!system) return await interaction.reply({ content: 'You need a system to configure proxy settings.', ephemeral: true });
                return await handleProxySection(interaction, user, system, sessionId);
            case 'notifications':
                return await handleNotificationSection(interaction, user, sessionId);
            case 'general':
                if (!system) return await interaction.reply({ content: 'You need a system to configure general settings.', ephemeral: true });
                return await handleGeneralSection(interaction, user, system, sessionId);
            default:
                return await handleMainMenu(interaction, user, system, sessionId);
        }
    },

    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ============================================
// MAIN MENU
// ============================================

async function handleMainMenu(interaction, user, system, sessionId) {
    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Settings')
        .setDescription('Select a settings section below.\n\n**Server** — Guild configuration (admin only)\n**Proxy** — Proxy style, layout, cooldown\n**Notifications** — Delivery preferences\n**General** — Sync, tags, terminology, migration');

    if (system) {
        embed.addFields(
            { name: 'Current Style', value: '`' + (system.proxy?.style || 'off') + '`', inline: true },
            { name: 'Cooldown', value: (system.setting?.proxyCoolDown || 3600) + ' seconds', inline: true },
            { name: 'Sync', value: system.syncWithApps?.discord ? 'Enabled' : 'Disabled', inline: true }
        );
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_section_server_' + sessionId).setLabel('Server').setStyle(ButtonStyle.Primary).setEmoji('🏠'),
        new ButtonBuilder().setCustomId('settings_section_proxy_' + sessionId).setLabel('Proxy').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('settings_section_notifications_' + sessionId).setLabel('Notifications').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
        new ButtonBuilder().setCustomId('settings_section_general_' + sessionId).setLabel('General').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    return await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
}

// ============================================
// SERVER SETTINGS (admin-gated)
// ============================================

async function checkServerAdmin(interaction, guild) {
    if (!guild) return false;
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

    let guildConfig = await Guild.findOne({ discordId: guild.id });
    if (!guildConfig) return false;

    if (guildConfig.admins?.memberIDs?.includes(interaction.user.id)) return true;

    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    if (memberRoles.some(r => guildConfig.admins?.roleIDs?.includes(r))) return true;

    return false;
}

async function handleServerSection(interaction, user, system, sessionId) {
    const isAdmin = await checkServerAdmin(interaction, interaction.guild);
    if (!isAdmin) {
        return await interaction.reply({
            content: 'You need **Administrator** permission or be added as a server admin to access server settings.\n\nAsk a server admin to add you via `/settings > Server > Admins > Add Member`.',
            ephemeral: true
        });
    }

    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({
            discordId: interaction.guild.id,
            userIDs: [],
            admins: { roleIDs: [], memberIDs: [] },
            channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false, reproxy: false } },
            settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false }
        });
        await guildConfig.save();
    }

    const session = utils.getSession(sessionId);
    if (session) session.guildId = interaction.guild.id;

    return await buildServerOverview(interaction, guildConfig, sessionId);
}

async function buildServerOverview(interaction, guildConfig, sessionId, isUpdate = false) {
    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Server Settings — ' + interaction.guild.name)
        .setDescription('Configure server-specific settings below.')
        .addFields(
            { name: 'Admins', value: 'Roles: ' + (guildConfig.admins?.roleIDs?.length || 0) + ' | Members: ' + (guildConfig.admins?.memberIDs?.length || 0), inline: true },
            { name: 'Channels', value: 'Blacklist: ' + (guildConfig.channels?.blacklist?.length || 0) + ' | Whitelist: ' + (guildConfig.channels?.whitelist?.length || 0), inline: true },
            { name: 'Log Channel', value: guildConfig.channels?.logChannel ? '<#' + guildConfig.channels.logChannel + '>' : '*Not set*', inline: true },
            { name: 'Log Events', value: [
                'Proxy: ' + (guildConfig.channels?.logEvents?.proxy ? '✅' : '❌'),
                'Edit: ' + (guildConfig.channels?.logEvents?.edit ? '✅' : '❌'),
                'Delete: ' + (guildConfig.channels?.logEvents?.delete ? '✅' : '❌'),
                'Reproxy: ' + (guildConfig.channels?.logEvents?.reproxy ? '✅' : '❌')
            ].join('\n'), inline: true },
            { name: 'Proxy Controls', value: [
                'Allow Proxy: ' + (guildConfig.settings?.allowProxy !== false ? '✅' : '❌'),
                'Force Disable Autoproxy: ' + (guildConfig.settings?.forceDisableAutoproxy ? '✅' : '❌'),
                'Force Reply Style: `' + (guildConfig.settings?.forceReplyStyle || 'off') + '`'
            ].join('\n'), inline: true },
            { name: 'Display', value: 'Closed Char Allowed: ' + (guildConfig.settings?.closedCharAllowed !== false ? '✅' : '❌'), inline: true }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_' + sessionId).setLabel('Admins').setStyle(ButtonStyle.Primary).setEmoji('👑'),
        new ButtonBuilder().setCustomId('settings_server_channels_' + sessionId).setLabel('Channels').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
        new ButtonBuilder().setCustomId('settings_server_logevents_' + sessionId).setLabel('Log Events').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_proxycontrols_' + sessionId).setLabel('Proxy Controls').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('settings_server_display_' + sessionId).setLabel('Display').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    if (isUpdate) return await interaction.update({ embeds: [embed], components: [row1, row2] });
    return await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
}

// ============================================
// PROXY SETTINGS
// ============================================

async function handleProxySection(interaction, user, system, sessionId) {
    const session = utils.getSession(sessionId);
    if (session) session.systemId = system._id.toString();
    return await buildProxyOverview(interaction, system, sessionId);
}

async function buildProxyOverview(interaction, system, sessionId, isUpdate = false) {
    const getLayoutDisplay = (layout) => {
        if (!layout) return '*Not set*';
        return layout.length > 50 ? layout.substring(0, 47) + '...' : layout;
    };

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Proxy Settings')
        .setDescription('Configure how proxied messages look and behave.')
        .addFields(
            { name: 'Style', value: '`' + (system.proxy?.style || 'off') + '`', inline: true },
            { name: 'Reply Style', value: '`' + (system.proxy?.replyStyle || 'embed') + '`', inline: true },
            { name: 'Cooldown', value: (system.setting?.proxyCoolDown || 3600) + 's', inline: true },
            { name: 'Case Sensitive', value: system.proxy?.caseSensitive ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Alter Layout', value: getLayoutDisplay(system.proxy?.layout?.alter), inline: false },
            { name: 'State Layout', value: getLayoutDisplay(system.proxy?.layout?.state), inline: false },
            { name: 'Group Layout', value: getLayoutDisplay(system.proxy?.layout?.group), inline: false }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_style_' + sessionId).setLabel('Style').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId('settings_proxy_replystyle_' + sessionId).setLabel('Reply Style').setStyle(system.proxy?.replyStyle === 'native' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(system.proxy?.replyStyle === 'native' ? '💬' : '📜'),
        new ButtonBuilder().setCustomId('settings_proxy_cooldown_' + sessionId).setLabel('Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('⏱️')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_serverstyle_' + sessionId).setLabel('Per-Server Style').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
        new ButtonBuilder().setCustomId('settings_proxy_serverreplystyle_' + sessionId).setLabel('Per-Server Reply').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
        new ButtonBuilder().setCustomId('settings_proxy_layout_' + sessionId).setLabel('Layout').setStyle(ButtonStyle.Secondary).setEmoji('📝')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_case_' + sessionId).setLabel('Case').setStyle(system.proxy?.caseSensitive ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(system.proxy?.caseSensitive ? '✅' : '🔤'),
        new ButtonBuilder().setCustomId('settings_proxy_break_' + sessionId).setLabel('Break').setStyle(system.proxy?.break ? ButtonStyle.Danger : ButtonStyle.Secondary).setEmoji(system.proxy?.break ? '⛔' : '▶️')
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    if (isUpdate) return await interaction.update({ embeds: [embed], components: [row1, row2, row3, row4] });
    return await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true });
}

// ============================================
// NOTIFICATION SETTINGS
// ============================================

async function handleNotificationSection(interaction, user, sessionId) {
    const session = utils.getSession(sessionId);
    if (session) session.userId = user._id.toString();
    return await buildNotificationOverview(interaction, user, sessionId);
}

async function buildNotificationOverview(interaction, user, sessionId) {
    const prefs = user.settings?.notificationPreferences || {};
    const embed = utils.buildNotificationSettingsEmbed(user);
    const components = utils.buildNotificationSettingsComponents(sessionId, prefs);
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.reply({ embeds: [embed], components: [...components, backRow], ephemeral: true });
}

// ============================================
// GENERAL SETTINGS
// ============================================

async function handleGeneralSection(interaction, user, system, sessionId) {
    const session = utils.getSession(sessionId);
    if (session) session.systemId = system._id.toString();
    return await buildGeneralOverview(interaction, user, system, sessionId);
}

async function buildGeneralOverview(interaction, user, system, sessionId, isUpdate = false) {
    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('General Settings')
        .setDescription(`${getSystemTerm(system)}-wide configuration options.`)
        .addFields(
            { name: 'Discord Sync', value: system.syncWithApps?.discord ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Timezone', value: system.timezone || '*Not set*', inline: true },
            { name: 'Terminology', value: getSystemTerm(system) + ' / ' + getAlterTerm(system, {plural:true}).charAt(0).toUpperCase() + getAlterTerm(system, {plural:true}).slice(1) + ' / ' + getAlterTerm(system, {plural:true}), inline: true },
            { name: 'Pronoun Separator', value: system.discord?.pronounSeparator || '*Not set*', inline: true },
            { name: 'Friend Auto-Bucket', value: system.setting?.friendAutoBucket || '*Not set*', inline: true },
            { name: 'Auto-share Notes', value: system.setting?.autoshareNotestoUsers ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Message Pings', value: user.settings?.allowPing !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Note Auto-Attribution', value: { topLayer: 'Top Layer', allFronters: 'All Fronters', off: 'Off' }[system.setting?.noteAutoAttribution || 'topLayer'], inline: true },
            { name: 'Attribution Display', value: user.settings?.noteAttributionStyle === 'entityOnly' ? 'Entity Only' : 'Entity + User', inline: true }
        );

    if (system.discord?.tag?.normal?.length > 0) {
        embed.addFields({ name: 'Proxy Tags', value: system.discord.tag.normal.map(t => '`' + t + '`').join(', '), inline: false });
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_sync_' + sessionId).setLabel('Discord Sync').setStyle(system.syncWithApps?.discord ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(system.syncWithApps?.discord ? '✅' : '🔄'),
        new ButtonBuilder().setCustomId('settings_general_tags_' + sessionId).setLabel('Tags').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
        new ButtonBuilder().setCustomId('settings_general_pronounsep_' + sessionId).setLabel('Pronoun Sep').setStyle(ButtonStyle.Secondary).setEmoji('🔤')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_terminology_' + sessionId).setLabel('Terminology').setStyle(ButtonStyle.Secondary).setEmoji('📖'),
        new ButtonBuilder().setCustomId('settings_general_timezone_' + sessionId).setLabel('Timezone').setStyle(ButtonStyle.Secondary).setEmoji('🕐'),
        new ButtonBuilder().setCustomId('settings_general_autoshare_' + sessionId).setLabel('Auto-share').setStyle(system.setting?.autoshareNotestoUsers ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(system.setting?.autoshareNotestoUsers ? '✅' : '📝')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_friendbucket_' + sessionId).setLabel('Friend Bucket').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('settings_general_allowping_' + sessionId).setLabel('Pings').setStyle(user.settings?.allowPing !== false ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji(user.settings?.allowPing !== false ? '✅' : '🔕'),
        new ButtonBuilder().setCustomId('settings_general_migration_' + sessionId).setLabel('Migration').setStyle(ButtonStyle.Secondary).setEmoji('📦'),
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_autoattribution_' + sessionId).setLabel('Auto-Attribution').setStyle(system.setting?.noteAutoAttribution !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(system.setting?.noteAutoAttribution !== 'off' ? '✅' : '🏷️'),
        new ButtonBuilder().setCustomId('settings_general_attributionstyle_' + sessionId).setLabel('Attribution Display').setStyle(ButtonStyle.Secondary).setEmoji('👁️')
    );

    if (isUpdate) return await interaction.update({ embeds: [embed], components: [row1, row2, row3, row4] });
    return await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true });
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: 'Session expired. Please run `/settings` again.', ephemeral: true });

    // Main menu back button
    if (customId.startsWith('settings_main_')) {
        const user = await User.findById(session.userId);
        const system = session.systemId ? await System.findById(session.systemId) : null;
        return await handleMainMenu(interaction, user, system, sessionId);
    }

    // Section entry buttons
    if (customId.startsWith('settings_section_server_')) {
        const user = await User.findById(session.userId);
        const system = session.systemId ? await System.findById(session.systemId) : null;
        return await handleServerSection(interaction, user, system, sessionId);
    }
    if (customId.startsWith('settings_section_proxy_')) {
        const user = await User.findById(session.userId);
        const system = await System.findById(session.systemId);
        return await handleProxySection(interaction, user, system, sessionId);
    }
    if (customId.startsWith('settings_section_notifications_')) {
        const user = await User.findById(session.userId);
        return await handleNotificationSection(interaction, user, sessionId);
    }
    if (customId.startsWith('settings_section_general_')) {
        const user = await User.findById(session.userId);
        const system = await System.findById(session.systemId);
        return await handleGeneralSection(interaction, user, system, sessionId);
    }

    // Server settings sub-sections
    if (customId.startsWith('settings_server_admins_') && !customId.includes('addrole') && !customId.includes('removerole')) {
        return await handleServerAdmins(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_channels_') && !customId.includes('blacklist') && !customId.includes('whitelist') && !customId.includes('logchannel')) {
        return await handleServerChannels(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_logevents_') && !customId.includes('toggle')) {
        return await handleServerLogEvents(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_proxycontrols_') && !customId.includes('toggle')) {
        return await handleServerProxyControls(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_display_') && !customId.includes('toggle')) {
        return await handleServerDisplay(interaction, sessionId);
    }

    // Proxy settings sub-sections
    if (customId.startsWith('settings_proxy_style_') && !customId.includes('server') && !customId.includes('modal') && !customId.includes('select') && !customId.includes('back')) {
        return await handleProxyStyleSelector(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_replystyle_') && !customId.includes('select') && !customId.includes('back')) {
        return await handleProxyReplyStyleSelect(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_serverstyle_') && !customId.includes('select') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleProxyServerStyle(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_serverreplystyle_') && !customId.includes('select') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleProxyServerReplyStyle(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_cooldown_') && !customId.includes('modal')) {
        return await handleProxyCooldownModal(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_layout_') && !customId.includes('modal') && !customId.includes('alter_') && !customId.includes('state_') && !customId.includes('group_') && !customId.includes('back') && !customId.includes('select')) {
        return await handleProxyLayoutSelector(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_case_')) {
        return await handleProxyCaseToggle(interaction, sessionId);
    }
    if (customId.startsWith('settings_proxy_break_')) {
        return await handleProxyBreakToggle(interaction, sessionId);
    }

    // Notification settings toggles
    if (customId.startsWith('settings_notif_toggle_')) {
        return await handleNotificationToggle(interaction, sessionId);
    }
    if (customId.startsWith('settings_notif_back_')) {
        const user = await User.findById(session.userId);
        return await handleNotificationSection(interaction, user, sessionId);
    }

    // General settings sub-sections
    if (customId.startsWith('settings_general_sync_')) {
        return await handleGeneralSyncToggle(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_tags_') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleGeneralTagsModal(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_pronounsep_') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleGeneralPronounSepModal(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_terminology_') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleGeneralTerminologyModal(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_timezone_') && !customId.includes('modal') && !customId.includes('back')) {
        return await handleGeneralTimezoneModal(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_autoshare_')) {
        return await handleGeneralAutoshareToggle(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_allowping_')) {
        return await handleGeneralAllowPingToggle(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_friendbucket_') && !customId.includes('select') && !customId.includes('back')) {
        return await handleGeneralFriendBucket(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_migration_')) {
        return await handleGeneralMigration(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_autoattribution_')) {
        return await handleGeneralAutoAttribution(interaction, sessionId);
    }
    if (customId.startsWith('settings_general_attributionstyle_')) {
        return await handleGeneralAttributionStyle(interaction, sessionId);
    }

    // Proxy layout sub-buttons
    if (customId.startsWith('settings_proxy_layout_alter_')) {
        return await handleProxyLayoutModalBtn(interaction, sessionId, 'alter');
    }
    if (customId.startsWith('settings_proxy_layout_state_')) {
        return await handleProxyLayoutModalBtn(interaction, sessionId, 'state');
    }
    if (customId.startsWith('settings_proxy_layout_group_')) {
        return await handleProxyLayoutModalBtn(interaction, sessionId, 'group');
    }
    if (customId.startsWith('settings_proxy_layout_back_')) {
        const system = await System.findById(session.systemId);
        return await buildProxyOverview(interaction, system, sessionId, true);
    }

    // Proxy style back
    if (customId.startsWith('settings_proxy_style_back_')) {
        const system = await System.findById(session.systemId);
        return await buildProxyOverview(interaction, system, sessionId, true);
    }

    // Proxy server style back
    if (customId.startsWith('settings_proxy_serverstyle_back_')) {
        const system = await System.findById(session.systemId);
        return await buildProxyOverview(interaction, system, sessionId, true);
    }

    // Proxy reply style back
    if (customId.startsWith('settings_proxy_replystyle_back_')) {
        const system = await System.findById(session.systemId);
        return await buildProxyOverview(interaction, system, sessionId, true);
    }

    // Proxy server reply style back
    if (customId.startsWith('settings_proxy_serverreplystyle_back_')) {
        const system = await System.findById(session.systemId);
        return await buildProxyOverview(interaction, system, sessionId, true);
    }

    // Server sub-section back buttons
    if (customId.startsWith('settings_server_admins_back_') ||
        customId.startsWith('settings_server_channels_back_') ||
        customId.startsWith('settings_server_logevents_back_') ||
        customId.startsWith('settings_server_proxycontrols_back_') ||
        customId.startsWith('settings_server_display_back_')) {
        const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
        return await buildServerOverview(interaction, guildConfig, sessionId, true);
    }

    // General sub-section back buttons
    if (customId.startsWith('settings_general_tags_back_') ||
        customId.startsWith('settings_general_friendbucket_back_')) {
        const system = await System.findById(session.systemId);
        const user = await User.findById(session.userId);
        return await buildGeneralOverview(interaction, user, system, sessionId, true);
    }

    // Server log event toggles
    if (customId.startsWith('settings_server_logevents_toggle_')) {
        return await handleServerLogEventToggle(interaction, sessionId);
    }

    // Server proxy control toggles
    if (customId.startsWith('settings_server_proxycontrols_toggle_')) {
        return await handleServerProxyControlToggle(interaction, sessionId);
    }

    // Server proxy control force reply style select
    if (customId.startsWith('settings_server_proxycontrols_forcereplystyle_')) {
        return await handleServerForceReplyStyleSelect(interaction, sessionId);
    }

    // Server display toggle
    if (customId.startsWith('settings_server_display_toggle_')) {
        return await handleServerDisplayToggle(interaction, sessionId);
    }

    // Server admin add/remove role buttons
    if (customId.startsWith('settings_server_admins_addrole_') && !customId.includes('select')) {
        return await handleServerAddRole(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_admins_removerole_') && !customId.includes('select')) {
        return await handleServerRemoveRole(interaction, sessionId);
    }

    // Server admin add/remove member buttons
    if (customId.startsWith('settings_server_admins_addmember_') && !customId.includes('select')) {
        return await handleServerAddMember(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_admins_removemember_') && !customId.includes('select')) {
        return await handleServerRemoveMember(interaction, sessionId);
    }

    // Server channel buttons
    if (customId.startsWith('settings_server_channels_blacklist_') && !customId.includes('select')) {
        return await handleServerBlacklist(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_channels_whitelist_') && !customId.includes('select')) {
        return await handleServerWhitelist(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_channels_logchannel_') && !customId.includes('select')) {
        return await handleServerLogChannel(interaction, sessionId);
    }
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const customId = interaction.customId;
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: 'Session expired.', ephemeral: true });

    // Notification delivery method
    if (customId.startsWith('settings_notif_method_')) {
        return await handleNotificationMethodSelect(interaction, sessionId);
    }

    // Proxy style select
    if (customId.startsWith('settings_proxy_style_select_')) {
        return await handleProxyStyleSelect(interaction, sessionId);
    }

    // Proxy reply style select
    if (customId.startsWith('settings_proxy_replystyle_select_')) {
        return await handleProxyReplyStyleSave(interaction, sessionId);
    }

    // Proxy server style select
    if (customId.startsWith('settings_proxy_serverstyle_select_')) {
        return await handleProxyServerStyleSelect(interaction, sessionId);
    }

    // Proxy server reply style select
    if (customId.startsWith('settings_proxy_serverreplystyle_select_')) {
        return await handleProxyServerReplyStyleSelect(interaction, sessionId);
    }

    // Server admins select
    if (customId.startsWith('settings_server_admins_addrole_select_')) {
        return await handleServerAddRoleSelect(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_admins_removerole_select_')) {
        return await handleServerRemoveRoleSelect(interaction, sessionId);
    }

    // Server admin member select
    if (customId.startsWith('settings_server_admins_addmember_select_')) {
        return await handleServerAddMemberSelect(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_admins_removemember_select_')) {
        return await handleServerRemoveMemberSelect(interaction, sessionId);
    }

    // Server channels select
    if (customId.startsWith('settings_server_channels_blacklist_select_')) {
        return await handleServerBlacklistSelect(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_channels_whitelist_select_')) {
        return await handleServerWhitelistSelect(interaction, sessionId);
    }
    if (customId.startsWith('settings_server_channels_logchannel_select_')) {
        return await handleServerLogChannelSelect(interaction, sessionId);
    }

    // General friend bucket select
    if (customId.startsWith('settings_general_friendbucket_select_')) {
        return await handleGeneralFriendBucketSelect(interaction, sessionId);
    }
}

// ============================================
// MODAL HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const customId = interaction.customId;
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: 'Session expired.', ephemeral: true });

    // Proxy cooldown modal
    if (customId.startsWith('settings_proxy_cooldown_modal_')) {
        return await handleProxyCooldownSave(interaction, sessionId);
    }

    // Proxy style modal
    if (customId.startsWith('settings_proxy_style_modal_')) {
        return await handleProxyStyleSave(interaction, sessionId);
    }

    // Proxy layout modals
    if (customId.startsWith('settings_proxy_layout_alter_modal_')) {
        return await handleProxyLayoutSave(interaction, sessionId, 'alter');
    }
    if (customId.startsWith('settings_proxy_layout_state_modal_')) {
        return await handleProxyLayoutSave(interaction, sessionId, 'state');
    }
    if (customId.startsWith('settings_proxy_layout_group_modal_')) {
        return await handleProxyLayoutSave(interaction, sessionId, 'group');
    }

    // Proxy server style modal
    if (customId.startsWith('settings_proxy_serverstyle_modal_')) {
        return await handleProxyServerStyleSave(interaction, sessionId);
    }

    // Proxy server reply style modal
    if (customId.startsWith('settings_proxy_serverreplystyle_modal_')) {
        return await handleProxyServerReplyStyleSave(interaction, sessionId);
    }

    // General pronoun separator modal
    if (customId.startsWith('settings_general_pronounsep_modal_')) {
        return await handleGeneralPronounSepSave(interaction, sessionId);
    }

    // General terminology modal
    if (customId.startsWith('settings_general_terminology_modal_')) {
        return await handleGeneralTerminologySave(interaction, sessionId);
    }

    // General timezone modal
    if (customId.startsWith('settings_general_timezone_modal_')) {
        return await handleGeneralTimezoneSave(interaction, sessionId);
    }

    // General tags modal
    if (customId.startsWith('settings_general_tags_modal_')) {
        return await handleGeneralTagsSave(interaction, sessionId);
    }
}

// ============================================
// SERVER SETTINGS HANDLERS
// ============================================

async function handleServerAdmins(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const adminRoles = guildConfig.admins?.roleIDs || [];
    const adminMembers = guildConfig.admins?.memberIDs || [];

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Server Admins')
        .setDescription('Manage who can access server settings.')
        .addFields(
            { name: 'Admin Roles', value: adminRoles.length > 0 ? adminRoles.map(r => '<@&' + r + '>').join('\n') : '*None*', inline: false },
            { name: 'Admin Members', value: adminMembers.length > 0 ? adminMembers.map(m => '<@' + m + '>').join('\n') : '*None*', inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_addrole_' + sessionId).setLabel('Add Role').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('settings_server_admins_removerole_' + sessionId).setLabel('Remove Role').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_addmember_' + sessionId).setLabel('Add Member').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('settings_server_admins_removemember_' + sessionId).setLabel('Remove Member').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('settings_server_admins_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, row2] });
}

async function handleServerAddRole(interaction, sessionId) {
    const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id && !r.managed).slice(0, 25);
    if (roles.size === 0) return await interaction.reply({ content: 'No roles available.', ephemeral: true });

    const options = roles.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id));

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Add Admin Role')
        .setDescription('Select a role to add as a server admin.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_admins_addrole_select_' + sessionId)
            .setPlaceholder('Select a role...')
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerRemoveRole(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    const adminRoles = guildConfig?.admins?.roleIDs || [];

    if (adminRoles.length === 0) {
        return await interaction.reply({ content: 'No admin roles to remove.', ephemeral: true });
    }

    const options = adminRoles.map(roleId => {
        const role = interaction.guild.roles.cache.get(roleId);
        return new StringSelectMenuOptionBuilder().setLabel(role?.name || roleId).setValue(roleId);
    });

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Remove Admin Role')
        .setDescription('Select a role to remove from server admins.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_admins_removerole_select_' + sessionId)
            .setPlaceholder('Select a role to remove...')
            .addOptions(options.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerAddMember(interaction, sessionId) {
    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Add Admin Member')
        .setDescription('Select a member to add as a server admin.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_admins_addmember_select_' + sessionId)
            .setPlaceholder('Select members...')
            .setMaxValues(25)
            .addOptions(
                interaction.guild.members.cache
                    .filter(m => !m.user.bot)
                    .slice(0, 25)
                    .map(m => new StringSelectMenuOptionBuilder().setLabel(m.displayName + ' (' + m.user.username + ')').setValue(m.id))
            )
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerRemoveMember(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    const adminMembers = guildConfig?.admins?.memberIDs || [];

    if (adminMembers.length === 0) {
        return await interaction.reply({ content: 'No admin members to remove.', ephemeral: true });
    }

    const options = adminMembers.map(memberId => {
        const member = interaction.guild.members.cache.get(memberId);
        return new StringSelectMenuOptionBuilder().setLabel(member?.displayName || member?.user?.username || memberId).setValue(memberId);
    });

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Remove Admin Member')
        .setDescription('Select a member to remove from server admins.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_admins_removemember_select_' + sessionId)
            .setPlaceholder('Select a member to remove...')
            .addOptions(options.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_admins_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerChannels(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Channel Configuration')
        .setDescription('Manage channel blacklists, whitelists, and log channels.')
        .addFields(
            { name: 'Blacklist', value: guildConfig.channels?.blacklist?.length > 0 ? guildConfig.channels.blacklist.length + ' channel(s)' : '*None*', inline: true },
            { name: 'Whitelist', value: guildConfig.channels?.whitelist?.length > 0 ? guildConfig.channels.whitelist.length + ' channel(s)' : '*None*', inline: true },
            { name: 'Log Channel', value: guildConfig.channels?.logChannel ? '<#' + guildConfig.channels.logChannel + '>' : '*Not set*', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_channels_blacklist_' + sessionId).setLabel('Blacklist').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_channels_whitelist_' + sessionId).setLabel('Whitelist').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_channels_logchannel_' + sessionId).setLabel('Log Channel').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_channels_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row] });
}

async function handleServerLogEvents(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const logEvents = guildConfig.channels?.logEvents || {};

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Log Events')
        .setDescription('Toggle which proxy events are logged.')
        .addFields(
            { name: 'Proxy', value: logEvents.proxy ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Edit', value: logEvents.edit ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Delete', value: logEvents.delete ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Reproxy', value: logEvents.reproxy ? 'Enabled' : 'Disabled', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_logevents_toggle_proxy_' + sessionId).setLabel('Proxy').setStyle(logEvents.proxy ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_logevents_toggle_edit_' + sessionId).setLabel('Edit').setStyle(logEvents.edit ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_logevents_toggle_delete_' + sessionId).setLabel('Delete').setStyle(logEvents.delete ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('settings_server_logevents_toggle_reproxy_' + sessionId).setLabel('Reproxy').setStyle(logEvents.reproxy ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_logevents_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerProxyControls(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const settings = guildConfig.settings || {};

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Proxy Controls')
        .setDescription('Toggle server-level proxy behavior.')
        .addFields(
            { name: 'Allow Proxy', value: settings.allowProxy !== false ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Force Disable Autoproxy', value: settings.forceDisableAutoproxy ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Force Reply Style', value: '`' + (settings.forceReplyStyle || 'off') + '`', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_proxycontrols_toggle_allow_' + sessionId).setLabel('Allow Proxy').setStyle(settings.allowProxy !== false ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('settings_server_proxycontrols_toggle_autoproxy_' + sessionId).setLabel('Force Disable Autoproxy').setStyle(settings.forceDisableAutoproxy ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_proxycontrols_forcereplystyle_' + sessionId)
            .setPlaceholder('Force Reply Style...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Off (User Choice)').setValue('off').setDescription('Use each user\'s personal reply style').setDefault(settings.forceReplyStyle === 'off' || !settings.forceReplyStyle),
                new StringSelectMenuOptionBuilder().setLabel('Force Embed').setValue('embed').setDescription('Force custom reply embeds for everyone').setDefault(settings.forceReplyStyle === 'embed'),
                new StringSelectMenuOptionBuilder().setLabel('Force Native').setValue('native').setDescription('Force Discord native replies for everyone').setDefault(settings.forceReplyStyle === 'native')
            )
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_proxycontrols_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, row2, backRow] });
}

async function handleServerDisplay(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Display Settings')
        .setDescription('Configure display-related settings for this server.')
        .addFields(
            { name: 'Closed Character Allowed', value: guildConfig.settings?.closedCharAllowed !== false ? 'Yes' : 'No', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_display_toggle_closedchar_' + sessionId).setLabel('Closed Char').setStyle(guildConfig.settings?.closedCharAllowed !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_display_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

// ============================================
// PROXY SETTINGS HANDLERS
// ============================================

async function handleProxyStyleSelector(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Proxy Style')
        .setDescription('Choose how auto-proxy selects entities.')
        .addFields(
            { name: 'Current Style', value: '`' + (system.proxy?.style || 'off') + '`', inline: true },
            { name: 'Options', value: '`off` — No auto-proxy\n`last` — Most recent entity\n`front` — Current fronter\n`<name>` — Specific entity', inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_proxy_style_select_' + sessionId)
            .setPlaceholder('Choose proxy style...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Off').setValue('off').setDefault(system.proxy?.style === 'off'),
                new StringSelectMenuOptionBuilder().setLabel('Last').setValue('last').setDefault(system.proxy?.style === 'last'),
                new StringSelectMenuOptionBuilder().setLabel('Front').setValue('front').setDefault(system.proxy?.style === 'front'),
                new StringSelectMenuOptionBuilder().setLabel('Specify Entity').setValue('specify').setDefault(!['off', 'last', 'front'].includes(system.proxy?.style))
            )
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_style_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleProxyServerStyle(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const servers = system.discord?.server || [];
    const customServers = servers.filter(s => s.proxyStyle && s.proxyStyle !== 'off');

    let value = 'Global default: `' + (system.proxy?.style || 'off') + '`\n';
    if (customServers.length > 0) {
        value += '\n**Per-server overrides:**\n';
        customServers.forEach(s => { value += '• ' + s.name + ': `' + s.proxyStyle + '`\n'; });
    } else {
        value += '\n*No per-server overrides*';
    }

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Per-Server Proxy Style')
        .setDescription('Override the global proxy style for specific servers.')
        .addFields({ name: 'Current Config', value: value.trim(), inline: false });

    const options = servers.slice(0, 24).map(s =>
        new StringSelectMenuOptionBuilder().setLabel(s.name).setValue(s.id).setDescription('Current: ' + (s.proxyStyle || 'off'))
    );

    if (options.length === 0) {
        options.push(new StringSelectMenuOptionBuilder().setLabel('No servers configured').setValue('none').setDisabled(true));
    }

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_proxy_serverstyle_select_' + sessionId)
            .setPlaceholder('Select a server...')
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_serverstyle_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleProxyCooldownModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_proxy_cooldown_modal_' + sessionId)
        .setTitle('Edit Proxy Cooldown');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('cooldown')
                .setLabel('Cooldown (in seconds)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(system.setting?.proxyCoolDown || 3600))
                .setRequired(true)
                .setMaxLength(10)
        )
    );

    return await interaction.showModal(modal);
}

async function handleProxyLayoutSelector(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const getLayoutDisplay = (layout) => {
        if (!layout) return '*Not set*';
        return layout.length > 50 ? layout.substring(0, 47) + '...' : layout;
    };

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Proxy Layout')
        .setDescription('Select which proxy layout to edit.')
        .addFields(
            { name: 'Alter Layout', value: getLayoutDisplay(system.proxy?.layout?.alter), inline: false },
            { name: 'State Layout', value: getLayoutDisplay(system.proxy?.layout?.state), inline: false },
            { name: 'Group Layout', value: getLayoutDisplay(system.proxy?.layout?.group), inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_layout_alter_' + sessionId).setLabel('Alter').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('settings_proxy_layout_state_' + sessionId).setLabel('State').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('settings_proxy_layout_group_' + sessionId).setLabel('Group').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('settings_proxy_layout_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row] });
}

async function handleProxyLayoutModalBtn(interaction, sessionId, type) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = utils.buildProxyLayoutModal(type, sessionId, system, 'settings');
    return await interaction.showModal(modal);
}

async function handleProxyCaseToggle(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    if (!system.proxy) system.proxy = {};
    system.proxy.caseSensitive = !system.proxy.caseSensitive;
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyBreakToggle(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    if (!system.proxy) system.proxy = {};
    system.proxy.break = !system.proxy.break;
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

// ============================================
// REPLY STYLE HANDLERS
// ============================================

async function handleProxyReplyStyleSelect(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const current = system.proxy?.replyStyle || 'embed';

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Reply Style')
        .setDescription('Choose how proxied message replies appear.')
        .addFields(
            { name: 'Current Style', value: '`' + current + '`', inline: true },
            { name: 'Embed', value: 'Custom reply embed with author info, preview, and thumbnail', inline: false },
            { name: 'Native', value: 'Discord\'s built-in reply feature ("Replying to...")', inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_proxy_replystyle_select_' + sessionId)
            .setPlaceholder('Choose reply style...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Embed').setValue('embed').setDescription('Custom reply embed').setDefault(current === 'embed'),
                new StringSelectMenuOptionBuilder().setLabel('Native').setValue('native').setDescription('Discord native reply').setDefault(current === 'native')
            )
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_replystyle_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleProxyReplyStyleSave(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const selected = interaction.values[0];
    if (!system.proxy) system.proxy = {};
    system.proxy.replyStyle = selected;
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyServerReplyStyle(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const servers = system.discord?.server || [];
    const customServers = servers.filter(s => s.replyStyle);

    let value = 'Global default: `' + (system.proxy?.replyStyle || 'embed') + '`\n';
    if (customServers.length > 0) {
        value += '\n**Per-server overrides:**\n';
        customServers.forEach(s => { value += '• ' + s.name + ': `' + s.replyStyle + '`\n'; });
    } else {
        value += '\n*No per-server overrides*';
    }

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Per-Server Reply Style')
        .setDescription('Override the global reply style for specific servers.')
        .addFields({ name: 'Current Config', value: value.trim(), inline: false });

    const options = servers.slice(0, 24).map(s =>
        new StringSelectMenuOptionBuilder().setLabel(s.name).setValue(s.id).setDescription('Current: ' + (s.replyStyle || 'default'))
    );

    if (options.length === 0) {
        options.push(new StringSelectMenuOptionBuilder().setLabel('No servers configured').setValue('none').setDisabled(true));
    }

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_proxy_serverreplystyle_select_' + sessionId)
            .setPlaceholder('Select a server...')
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_proxy_serverreplystyle_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleProxyServerReplyStyleSelect(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const guildId = interaction.values[0];
    if (guildId === 'none') return await handleProxyServerReplyStyle(interaction, sessionId);

    session.serverReplyStyleGuildId = guildId;

    const serverEntry = system.discord?.server?.find(s => s.id === guildId);
    if (!serverEntry) return await interaction.reply({ content: 'Server not found.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_proxy_serverreplystyle_modal_' + sessionId)
        .setTitle('Edit Reply Style for ' + serverEntry.name);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('server_replystyle')
                .setLabel('Reply Style (embed/native/default)')
                .setStyle(TextInputStyle.Short)
                .setValue(serverEntry.replyStyle || 'default')
                .setPlaceholder('embed, native, or default')
                .setRequired(false)
                .setMaxLength(10)
        )
    );

    return await interaction.showModal(modal);
}

async function handleProxyServerReplyStyleSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const style = interaction.fields.getTextInputValue('server_replystyle')?.toLowerCase()?.trim() || 'default';

    if (!session.serverReplyStyleGuildId) {
        return await interaction.reply({ content: 'No server selected. Please select a server first.', ephemeral: true });
    }

    if (!system.discord) system.discord = {};
    if (!system.discord.server) system.discord.server = [];

    let serverEntry = system.discord.server.find(s => s.id === session.serverReplyStyleGuildId);
    if (!serverEntry) {
        return await interaction.reply({ content: 'Server entry not found.', ephemeral: true });
    }

    if (style === 'default') {
        delete serverEntry.replyStyle;
    } else {
        serverEntry.replyStyle = style;
    }
    await system.save();

    return await handleProxyServerReplyStyle(interaction, sessionId);
}

// ============================================
// NOTIFICATION SETTINGS HANDLERS
// ============================================

async function handleNotificationMethodSelect(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const user = await User.findById(session.userId);
    if (!user) return await interaction.reply({ content: 'User not found.', ephemeral: true });

    const selectedMethod = interaction.values[0];
    if (!user.settings) user.settings = {};
    if (!user.settings.notificationPreferences) user.settings.notificationPreferences = {};
    user.settings.notificationPreferences.friendNotifications = selectedMethod;
    await user.save();

    return await buildNotificationOverview(interaction, user, sessionId);
}

async function handleNotificationToggle(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const user = await User.findById(session.userId);
    if (!user) return await interaction.reply({ content: 'User not found.', ephemeral: true });

    let field = null;
    if (interaction.customId.includes('friendRequests')) field = 'friendRequests';
    if (interaction.customId.includes('friendSwitches')) field = 'friendSwitches';
    if (interaction.customId.includes('appMessages')) field = 'appMessages';
    if (!field) return await interaction.reply({ content: 'Unknown notification setting.', ephemeral: true });

    if (!user.settings) user.settings = {};
    if (!user.settings.notificationPreferences) user.settings.notificationPreferences = {};
    const currentEnabled = user.settings.notificationPreferences[field] !== false;
    user.settings.notificationPreferences[field] = !currentEnabled;
    await user.save();

    const prefs = user.settings.notificationPreferences;
    const embed = utils.buildNotificationSettingsEmbed(user);
    const components = utils.buildNotificationSettingsComponents(sessionId, prefs);
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [...components, backRow] });
}

// ============================================
// GENERAL SETTINGS HANDLERS
// ============================================

async function handleGeneralSyncToggle(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    system.syncWithApps = system.syncWithApps || {};
    system.syncWithApps.discord = !system.syncWithApps.discord;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralTagsModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const tags = system.discord?.tag?.normal || [];

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Proxy Tags')
        .setDescription('Tags appear in proxy messages. Use `{tag1}`, `{tag2}`, etc. in your layout.')
        .addFields({ name: 'Current Tags', value: tags.length > 0 ? tags.map(t => '`' + t + '`').join(', ') : '*None*', inline: false });

    const modal = new ModalBuilder()
        .setCustomId('settings_general_tags_modal_' + sessionId)
        .setTitle('Edit Proxy Tags');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('tags')
                .setLabel('Tags (comma-separated)')
                .setStyle(TextInputStyle.Short)
                .setValue(tags.join(', '))
                .setPlaceholder('e.g., TC, Colorwheel, System')
                .setRequired(false)
                .setMaxLength(200)
        )
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_tags_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.showModal(modal);
}

async function handleGeneralPronounSepModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_general_pronounsep_modal_' + sessionId)
        .setTitle('Edit Pronoun Separator');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('separator')
                .setLabel('Pronoun Separator')
                .setStyle(TextInputStyle.Short)
                .setValue(system.discord?.pronounSeparator || '')
                .setPlaceholder('e.g., / or • or ,')
                .setRequired(false)
                .setMaxLength(5)
        )
    );

    return await interaction.showModal(modal);
}

async function handleGeneralTerminologyModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_general_terminology_modal_' + sessionId)
        .setTitle('Edit Terminology');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('singular')
                .setLabel('Singular (e.g., alter)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.alterSynonym?.singular || 'alter')
                .setRequired(false)
                .setMaxLength(30)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('plural')
                .setLabel('Plural (e.g., alters)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.alterSynonym?.plural || 'alters')
                .setRequired(false)
                .setMaxLength(30)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('systemSynonym')
                .setLabel(getSystemTerm(system) + ' synonym (e.g., system, collective)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.systemSynonym || 'system')
                .setRequired(false)
                .setMaxLength(30)
        )
    );

    return await interaction.showModal(modal);
}

async function handleGeneralTimezoneModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_general_timezone_modal_' + sessionId)
        .setTitle('Edit Timezone');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('timezone')
                .setLabel('Timezone (e.g., America/New_York)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.timezone || '')
                .setPlaceholder('e.g., America/New_York, Europe/London')
                .setRequired(false)
                .setMaxLength(50)
        )
    );

    return await interaction.showModal(modal);
}

async function handleGeneralAutoshareToggle(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    if (!system.setting) system.setting = {};
    system.setting.autoshareNotestoUsers = !system.setting.autoshareNotestoUsers;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralAllowPingToggle(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const user = await User.findById(session.userId);
    if (!user) return await interaction.reply({ content: 'User not found.', ephemeral: true });

    if (!user.settings) user.settings = {};
    user.settings.allowPing = user.settings.allowPing === false ? true : (user.settings.allowPing === undefined ? false : !user.settings.allowPing);
    await user.save();

    const system = await System.findById(session.systemId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

const AUTO_ATTRIBUTION_OPTIONS = ['topLayer', 'allFronters', 'off'];
const AUTO_ATTRIBUTION_LABELS = { topLayer: 'Top Layer', allFronters: 'All Fronters', off: 'Off' };

async function handleGeneralAutoAttribution(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    if (!system.setting) system.setting = {};
    const current = system.setting.noteAutoAttribution || 'topLayer';
    const nextIndex = (AUTO_ATTRIBUTION_OPTIONS.indexOf(current) + 1) % AUTO_ATTRIBUTION_OPTIONS.length;
    system.setting.noteAutoAttribution = AUTO_ATTRIBUTION_OPTIONS[nextIndex];
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralAttributionStyle(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const user = await User.findById(session.userId);
    if (!user) return await interaction.reply({ content: 'User not found.', ephemeral: true });

    if (!user.settings) user.settings = {};
    user.settings.noteAttributionStyle = user.settings.noteAttributionStyle === 'entityOnly' ? 'entityAndUser' : 'entityOnly';
    await user.save();

    const system = await System.findById(session.systemId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralFriendBucket(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const buckets = system.privacyBuckets || [];

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Friend Auto-Bucket')
        .setDescription('The default privacy bucket applied to new friends.')
        .addFields({ name: 'Current', value: system.setting?.friendAutoBucket || '*Not set*', inline: false });

    if (buckets.length === 0) {
        embed.addFields({ name: 'Available Buckets', value: '*No privacy buckets created yet.*', inline: false });
    } else {
        embed.addFields({ name: 'Available Buckets', value: buckets.map(b => '• ' + b.name).join('\n'), inline: false });
    }

    const options = [
        new StringSelectMenuOptionBuilder().setLabel('None (clear)').setValue('').setDefault(!system.setting?.friendAutoBucket)
    ];
    buckets.forEach(b => {
        options.push(new StringSelectMenuOptionBuilder().setLabel(b.name).setValue(b.name).setDefault(system.setting?.friendAutoBucket === b.name));
    });

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_general_friendbucket_select_' + sessionId)
            .setPlaceholder('Select default bucket...')
            .addOptions(options.slice(0, 25))
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_general_friendbucket_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleGeneralMigration(interaction, sessionId) {
    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Migration Tools')
        .setDescription('Import and export tools are coming soon!\n\n**Planned support:**\n• PluralKit (API + file)\n• Simply Plural (API)\n• Octocon\n• Tupperbox (file)\n• JSON export/import\n\nFor now, use the prefix commands:\n`sys!import` — Import from other platforms\n`sys!convert` — Convert alters to states');

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_main_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Danger)
    );

    return await interaction.update({ embeds: [embed], components: [backRow] });
}

// ============================================
// SAVE HANDLERS (modals & selects)
// ============================================

async function handleProxyCooldownSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown'));
    if (isNaN(cooldown) || cooldown < 0) {
        return await interaction.reply({ content: 'Invalid cooldown value. Please enter a positive number.', ephemeral: true });
    }

    if (!system.setting) system.setting = {};
    system.setting.proxyCoolDown = cooldown;
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyStyleSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const style = interaction.fields.getTextInputValue('proxy_style')?.toLowerCase()?.trim();
    const onBreak = interaction.fields.getTextInputValue('proxy_break');

    const validation = utils.validateProxyStyle(style);

    if (validation.isEntityName) {
        const { entity } = await utils.findEntityByNameForSystem(validation.finalStyle, system);
        if (entity) {
            system.proxy.style = entity.name?.indexable || validation.finalStyle;
        } else {
            if (!system.proxy) system.proxy = {};
            system.proxy.break = onBreak?.toLowerCase() === 'yes';
            await system.save();
            return await interaction.reply({
                content: 'Could not find an entity named "' + validation.finalStyle + '". Style was not changed.',
                ephemeral: true
            });
        }
    } else {
        system.proxy.style = validation.finalStyle;
    }

    system.proxy.break = onBreak?.toLowerCase() === 'yes';
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyLayoutSave(interaction, sessionId, type) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    if (!system.proxy) system.proxy = {};
    if (!system.proxy.layout || typeof system.proxy.layout === 'string') {
        const oldLayout = typeof system.proxy.layout === 'string' ? system.proxy.layout : '';
        system.proxy.layout = { alter: oldLayout, state: oldLayout, group: oldLayout };
    }

    const layout = interaction.fields.getTextInputValue('layout');
    system.proxy.layout[type] = layout || '';
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyStyleSelect(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const selected = interaction.values[0];

    if (selected === 'specify') {
        return await handleProxyStyleModal(interaction, sessionId);
    }

    system.proxy.style = selected;
    await system.save();

    return await buildProxyOverview(interaction, system, sessionId, true);
}

async function handleProxyStyleModal(interaction, sessionId) {
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const modal = utils.buildProxyStyleModal(sessionId, system, 'settings');
    return await interaction.showModal(modal);
}

async function handleProxyServerStyleSelect(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const guildId = interaction.values[0];
    if (guildId === 'none') return await handleProxyServerStyle(interaction, sessionId);

    // Store guildId in session for the modal save handler
    session.serverStyleGuildId = guildId;

    const serverEntry = system.discord?.server?.find(s => s.id === guildId);
    if (!serverEntry) return await interaction.reply({ content: 'Server not found.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId('settings_proxy_serverstyle_modal_' + sessionId)
        .setTitle('Edit Proxy Style for ' + serverEntry.name);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('server_style')
                .setLabel('Proxy Style (off/last/front/entity name)')
                .setStyle(TextInputStyle.Short)
                .setValue(serverEntry.proxyStyle || 'off')
                .setPlaceholder('off, last, front, or entity name')
                .setRequired(false)
                .setMaxLength(50)
        )
    );

    return await interaction.showModal(modal);
}

async function handleProxyServerStyleSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const style = interaction.fields.getTextInputValue('server_style')?.toLowerCase()?.trim() || 'off';

    // Find which server this is for - we need to get it from the previous interaction context
    // Since we don't have the guildId directly, we'll need to use the last selected server
    // For simplicity, let's store it in the session
    // Actually, the modal customId doesn't include the guildId. Let me fix this.
    // For now, the per-server style save needs the guildId from the select menu.
    // We'll need to track this differently.

    // Simple approach: find the server that was last selected by checking which one doesn't match
    // This is a limitation - we need to pass the guildId through the modal customId
    // Let's use the session to store it

    if (!session.serverStyleGuildId) {
        return await interaction.reply({ content: 'No server selected. Please select a server first.', ephemeral: true });
    }

    if (!system.discord) system.discord = {};
    if (!system.discord.server) system.discord.server = [];

    let serverEntry = system.discord.server.find(s => s.id === session.serverStyleGuildId);
    if (!serverEntry) {
        return await interaction.reply({ content: 'Server entry not found.', ephemeral: true });
    }

    serverEntry.proxyStyle = style;
    await system.save();

    return await handleProxyServerStyle(interaction, sessionId);
}

async function handleServerAddRoleSelect(interaction, sessionId) {
    const roleId = interaction.values[0];
    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({ discordId: interaction.guild.id, admins: { roleIDs: [], memberIDs: [] }, channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false } }, settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false } });
    }
    if (!guildConfig.admins) guildConfig.admins = { roleIDs: [], memberIDs: [] };
    if (!guildConfig.admins.roleIDs.includes(roleId)) {
        guildConfig.admins.roleIDs.push(roleId);
    }
    await guildConfig.save();

    return await handleServerAdmins(interaction, sessionId);
}

async function handleServerRemoveRoleSelect(interaction, sessionId) {
    const roleId = interaction.values[0];
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    guildConfig.admins.roleIDs = guildConfig.admins.roleIDs.filter(r => r !== roleId);
    await guildConfig.save();

    return await handleServerAdmins(interaction, sessionId);
}

async function handleServerAddMemberSelect(interaction, sessionId) {
    const memberIds = interaction.values;
    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({ discordId: interaction.guild.id, admins: { roleIDs: [], memberIDs: [] }, channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false } }, settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false } });
    }
    if (!guildConfig.admins) guildConfig.admins = { roleIDs: [], memberIDs: [] };
    for (const id of memberIds) {
        if (!guildConfig.admins.memberIDs.includes(id)) {
            guildConfig.admins.memberIDs.push(id);
        }
    }
    await guildConfig.save();

    return await handleServerAdmins(interaction, sessionId);
}

async function handleServerRemoveMemberSelect(interaction, sessionId) {
    const memberId = interaction.values[0];
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    guildConfig.admins.memberIDs = guildConfig.admins.memberIDs.filter(m => m !== memberId);
    await guildConfig.save();

    return await handleServerAdmins(interaction, sessionId);
}

async function handleServerBlacklist(interaction, sessionId) {
    const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).slice(0, 25);
    if (channels.size === 0) return await interaction.reply({ content: 'No text channels available.', ephemeral: true });

    const options = channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id));

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Set Channel Blacklist')
        .setDescription('Select channels where proxying should be disabled.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_channels_blacklist_select_' + sessionId)
            .setPlaceholder('Select channels to blacklist...')
            .setMaxValues(25)
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_channels_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerWhitelist(interaction, sessionId) {
    const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).slice(0, 25);
    if (channels.size === 0) return await interaction.reply({ content: 'No text channels available.', ephemeral: true });

    const options = channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id));

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Set Channel Whitelist')
        .setDescription('Select channels where proxying should be allowed. Overrides blacklist.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_channels_whitelist_select_' + sessionId)
            .setPlaceholder('Select channels to whitelist...')
            .setMaxValues(25)
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_channels_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerLogChannel(interaction, sessionId) {
    const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).slice(0, 25);
    if (channels.size === 0) return await interaction.reply({ content: 'No channels available.', ephemeral: true });

    const options = channels.map(c => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id));

    const embed = new EmbedBuilder()
        .setColor(SETTINGS_COLOR)
        .setTitle('Set Log Channel')
        .setDescription('Select the channel where proxy events should be logged.');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_server_channels_logchannel_select_' + sessionId)
            .setPlaceholder('Select log channel...')
            .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_server_channels_back_' + sessionId).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    return await interaction.update({ embeds: [embed], components: [row, backRow] });
}

async function handleServerBlacklistSelect(interaction, sessionId) {
    const channelIds = interaction.values;
    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({ discordId: interaction.guild.id, admins: { roleIDs: [], memberIDs: [] }, channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false } }, settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false } });
    }
    guildConfig.channels.blacklist = channelIds;
    await guildConfig.save();

    return await handleServerChannels(interaction, sessionId);
}

async function handleServerWhitelistSelect(interaction, sessionId) {
    const channelIds = interaction.values;
    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({ discordId: interaction.guild.id, admins: { roleIDs: [], memberIDs: [] }, channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false } }, settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false } });
    }
    guildConfig.channels.whitelist = channelIds;
    await guildConfig.save();

    return await handleServerChannels(interaction, sessionId);
}

async function handleServerLogChannelSelect(interaction, sessionId) {
    const channelId = interaction.values[0];
    let guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) {
        guildConfig = new Guild({ discordId: interaction.guild.id, admins: { roleIDs: [], memberIDs: [] }, channels: { blacklist: [], whitelist: [], logChannel: null, logEvents: { proxy: true, edit: false, delete: false } }, settings: { closedCharAllowed: true, allowProxy: true, forceDisableAutoproxy: false } });
    }
    guildConfig.channels.logChannel = channelId;
    await guildConfig.save();

    return await handleServerChannels(interaction, sessionId);
}

async function handleServerLogEventToggle(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    let field = null;
    if (interaction.customId.includes('toggle_proxy')) field = 'proxy';
    if (interaction.customId.includes('toggle_edit')) field = 'edit';
    if (interaction.customId.includes('toggle_delete')) field = 'delete';
    if (interaction.customId.includes('toggle_reproxy')) field = 'reproxy';
    if (!field) return await interaction.reply({ content: 'Unknown log event.', ephemeral: true });

    if (!guildConfig.channels) guildConfig.channels = { logEvents: { proxy: true, edit: false, delete: false, reproxy: false } };
    if (!guildConfig.channels.logEvents) guildConfig.channels.logEvents = { proxy: true, edit: false, delete: false, reproxy: false };
    guildConfig.channels.logEvents[field] = !guildConfig.channels.logEvents[field];
    await guildConfig.save();

    return await handleServerLogEvents(interaction, sessionId);
}

async function handleServerProxyControlToggle(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    if (interaction.customId.includes('toggle_allow')) {
        guildConfig.settings.allowProxy = !guildConfig.settings.allowProxy;
    }
    if (interaction.customId.includes('toggle_autoproxy')) {
        guildConfig.settings.forceDisableAutoproxy = !guildConfig.settings.forceDisableAutoproxy;
    }
    await guildConfig.save();

    return await handleServerProxyControls(interaction, sessionId);
}

async function handleServerForceReplyStyleSelect(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    const selected = interaction.values[0];
    if (!guildConfig.settings) guildConfig.settings = {};
    guildConfig.settings.forceReplyStyle = selected;
    await guildConfig.save();

    return await handleServerProxyControls(interaction, sessionId);
}

async function handleServerDisplayToggle(interaction, sessionId) {
    const guildConfig = await Guild.findOne({ discordId: interaction.guild.id });
    if (!guildConfig) return await interaction.reply({ content: 'Server config not found.', ephemeral: true });

    guildConfig.settings.closedCharAllowed = !guildConfig.settings.closedCharAllowed;
    await guildConfig.save();

    return await handleServerDisplay(interaction, sessionId);
}

async function handleGeneralFriendBucketSelect(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const bucket = interaction.values[0];
    if (!system.setting) system.setting = {};
    system.setting.friendAutoBucket = bucket || undefined;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralPronounSepSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const separator = interaction.fields.getTextInputValue('separator');
    if (!system.discord) system.discord = {};
    system.discord.pronounSeparator = separator || undefined;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralTerminologySave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const singular = interaction.fields.getTextInputValue('singular');
    const plural = interaction.fields.getTextInputValue('plural');
    const systemSynonym = interaction.fields.getTextInputValue('systemSynonym');

    if (!system.alterSynonym) system.alterSynonym = {};
    system.alterSynonym.singular = singular || 'alter';
    system.alterSynonym.plural = plural || 'alters';
    system.systemSynonym = systemSynonym || 'system';
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralTimezoneSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const timezone = interaction.fields.getTextInputValue('timezone');
    system.timezone = timezone || undefined;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}

async function handleGeneralTagsSave(interaction, sessionId) {
    const session = utils.getSession(sessionId);
    const system = await System.findById(session.systemId);
    if (!system) return await interaction.reply({ content: 'Not registered.', ephemeral: true });

    const tagsInput = interaction.fields.getTextInputValue('tags');
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    if (!system.discord) system.discord = {};
    if (!system.discord.tag) system.discord.tag = {};
    system.discord.tag.normal = tags;
    await system.save();

    const user = await User.findById(session.userId);
    return await buildGeneralOverview(interaction, user, system, sessionId, true);
}
