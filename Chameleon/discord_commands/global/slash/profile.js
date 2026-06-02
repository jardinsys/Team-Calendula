// (/profile) - Systemiser Profile Command
// User-level profile management with optional system integration

// (/profile show [user] [userid])
// (/profile manage action:(edit/settings))

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

const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');

const { getSystemEmbedColor } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View and manage your profile')

        // SHOW subcommand
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('View your profile or another user\'s profile')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('View another user\'s profile')
                .setRequired(false))
            // .addStringOption(opt => opt.setName('userid').setDescription('Discord User ID (for users outside the server)').setRequired(false))
        )

        // MANAGE subcommand
        .addSubcommand(sub => sub
            .setName('manage')
            .setDescription('Edit your profile or settings')
            .addStringOption(opt => opt
                .setName('action')
                .setDescription('What to manage')
                .setRequired(true)
                .addChoices(
                    { name: 'Edit - Modify profile information', value: 'edit' },
                    { name: 'Settings - Configure profile settings', value: 'settings' }
                ))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'profile');

        switch (subcommand) {
            case 'show': return await handleShow(interaction, user, system); break;
            case 'manage': return await handleManage(interaction, user, system); break;
        }
    },

    handleButtonInteraction,
    handleSelectMenu,
    handleModalSubmit
};

// ==== EMBED BUILDERS ====

async function buildProfileCard(user, system, isOwner, privacyBucket, closedCharAllowed, interaction) {
    const embed = new EmbedBuilder();

    const displayName = user.discord?.name?.display || '(unknown)';

    embed.setAuthor({
        name: `${displayName}'s Profile`,
        iconURL: interaction.user?.displayAvatarURL() || undefined
    });

    const profileColor = getSystemEmbedColor(system);
    if (profileColor) embed.setColor(profileColor);

    if (user.discord?.description) embed.setDescription(user.discord.description);
    embed.setThumbnail(interaction.user?.displayAvatarURL() || null);

    // Basic Info field
    let basicInfo = '';
    if (user.pronouns?.length > 0) {
        const separator = user.pronounSeperator || '/';
        basicInfo += `**Pronouns:** ${user.pronouns.join(separator)}\n`;
    }
    if (user.friendID && isOwner) basicInfo += `**Friend ID:** \`${user.friendID}\`\n`;
    if (basicInfo) embed.addFields({ name: '📋 Info', value: basicInfo.trim(), inline: false });

    // Current Status field (from system) — privacy-checked
    if (system) {
        const systemPrivacy = system.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
        const showFrontInfo = isOwner || systemPrivacy?.settings?.front?.hidden !== true;

        if (showFrontInfo) {
            let statusInfo = '';
            if (system.front?.status) statusInfo += `**Status:** ${system.front.status}\n`;
            if (system.battery !== undefined && system.battery !== null) {
                const batteryEmoji = utils.getBatteryEmoji(system.battery);
                statusInfo += `**Social Battery:** ${batteryEmoji} ${system.battery}%\n`;
            }
            if (system.front?.caution) statusInfo += `**⚠️ Caution:** ${system.front.caution}\n`;
            if (statusInfo) embed.addFields({ name: '💭 Current Status', value: statusInfo.trim(), inline: false });
        }
    }

    // Proxy Settings field (owner only)
    if (system && isOwner) {
        let proxyInfo = '';
        const proxyStyle = system.proxy?.style || 'off';
        proxyInfo += `**Auto-proxy:** ${proxyStyle}\n`;
        if (system.proxy?.break) proxyInfo += `**🛑 On Break:** Yes\n`;
        if (proxyInfo) embed.addFields({ name: '💬 Proxy', value: proxyInfo.trim(), inline: false });
    }

    // Account Info field
    let accountInfo = '';
    if (user.joinedAt) {
        const joinedTimestamp = Math.floor(new Date(user.joinedAt).getTime() / 1000);
        accountInfo += `**Joined:** <t:${joinedTimestamp}:R>\n`;
    }
    if (user.friends?.length > 0 && isOwner) accountInfo += `**Friends:** ${user.friends.length}\n`;
    if (accountInfo) embed.addFields({ name: '📊 Account', value: accountInfo.trim(), inline: false });

    return embed;
}

function buildEditInterface(user, system, session) {
    const displayName = user.discord?.name?.display || '(unknown)';

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editing: ${displayName}'s Profile`)
        .setDescription('Select what you would like to edit from the dropdown menu below.');

    const editColor = getSystemEmbedColor(system);
    if (editColor) embed.setColor(editColor);

    let currentValues = '';
    if (user.discord?.name?.display) currentValues += `**Display Name:** ${user.discord.name.display}\n`;
    if (user.pronouns?.length > 0) currentValues += `**Pronouns:** ${user.pronouns.join(user.pronounSeperator || '/')}\n`;
    if (user.discord?.description) {
        const desc = user.discord.description.length > 50 ? user.discord.description.substring(0, 47) + '...' : user.discord.description;
        currentValues += `**Bio:** ${desc}\n`;
    }
    if (system) {
        if (system.front?.status) currentValues += `**Status:** ${system.front.status}\n`;
        if (system.battery !== undefined) currentValues += `**Battery:** ${system.battery}%\n`;
        if (system?.front?.caution) currentValues += `**⚠️ Caution:** ${system.front.caution}\n`;
    }
    if (currentValues) embed.addFields({ name: '📋 Current Values', value: currentValues.trim(), inline: false });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`profile_edit_select_${session.id}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Basic Info').setDescription('Edit display name, pronouns, bio').setValue('basic_info').setEmoji('📋'),
            new StringSelectMenuOptionBuilder().setLabel('Current Status').setDescription('Edit status, social battery, and caution').setValue('status_info').setEmoji('💭'),
            new StringSelectMenuOptionBuilder().setLabel('Proxy Settings').setDescription('Edit auto-proxy style and break status').setValue('proxy_info').setEmoji('💬')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`profile_edit_settings_${session.id}`).setLabel('Profile Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId(`profile_edit_done_${session.id}`).setLabel('Done').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    return { embed, components: [selectRow, actionRow] };
}

function buildSettingsInterface(user, system, session) {
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Profile Settings`)
        .setDescription('Configure your profile settings below.');

    const settingsColor = getSystemEmbedColor(system);
    if (settingsColor) embed.setColor(settingsColor);

    embed.addFields(
        { name: 'Closed Characters', value: user.settings?.closedCharAllowed !== false ? '✅ Allowed' : '❌ Disabled', inline: true }
    );

    if (system?.privacyBuckets?.length > 0) {
        const bucketNames = system.privacyBuckets.map(b => b.name).join(', ');
        embed.addFields({ name: '🔒 Privacy Buckets', value: bucketNames, inline: false });
    }

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`profile_settings_closedchar_${session.id}`).setLabel('Toggle Closed Characters').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`profile_settings_privacy_${session.id}`).setLabel('Privacy Settings').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
        new ButtonBuilder().setCustomId(`profile_settings_back_${session.id}`).setLabel('Back to Edit').setStyle(ButtonStyle.Danger)
    );

    return { embed, components: [buttons] };
}

// ==== COMMAND HANDLERS ====

async function handleShow(interaction, currentUser, currentSystem) {
    const targetDiscordUser = interaction.options.getUser('user');
    // const targetUserId = interaction.options.getString('userid');

    let user = currentUser;
    let system = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    if (targetDiscordUser /* || targetUserId */) {
        isOwner = false;
        const discordId = targetDiscordUser?.id /* || targetUserId */;
        user = await User.findOne({ discordID: discordId });
        if (!user) return await interaction.reply({ content: '❌ This user hasn\'t set up a profile yet.', ephemeral: true });

        if (user.systemID) system = await System.findById(user.systemID);

        if (currentUser && utils.isBlocked(user, interaction.user.id, currentUser.friendID))
            return await interaction.reply({ content: '❌ This user\'s profile is not available.', ephemeral: true });

        if (system) privacyBucket = utils.getPrivacyBucket(system, interaction.user.id, interaction.guildId);
    }

    if (!user) return await interaction.reply({ content: '❌ User not found.', ephemeral: true });

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildProfileCard(user, system, isOwner, privacyBucket, closedCharAllowed, interaction);

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'show', userId: user._id, systemId: system?._id, isOwner });

    const components = [];
    if (isOwner) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`profile_edit_${sessionId}`).setLabel('Edit Profile').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
            new ButtonBuilder().setCustomId(`profile_quick_status_${sessionId}`).setLabel('Update Status').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`profile_quick_battery_${sessionId}`).setLabel('Update Battery').setStyle(ButtonStyle.Secondary).setEmoji('🔋'),
            new ButtonBuilder().setCustomId(`profile_quick_caution_${sessionId}`).setLabel('Update Caution').setStyle(ButtonStyle.Secondary).setEmoji('⚠️')
        ));
    }

    await interaction.reply({ embeds: [embed], components });
}

async function handleManage(interaction, user, system) {
    const action = interaction.options.getString('action');

    switch (action) {
        case 'edit': return await handleEdit(interaction, user, system); break;
        case 'settings': return await handleSettings(interaction, user, system); break;
    }
}

async function handleEdit(interaction, user, system) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'edit', userId: user._id, systemId: system?._id });

    const { embed, components } = buildEditInterface(user, system, { id: sessionId });
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleSettings(interaction, user, system) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'settings', userId: user._id, systemId: system?._id });

    const { embed, components } = buildSettingsInterface(user, system, { id: sessionId });
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// ==== BUTTON HANDLER ====

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;

    // Edit button from show view
    if (customId.startsWith('profile_edit_') && !customId.includes('_select_') && !customId.includes('_done_') && !customId.includes('_settings_')) {
        session.type = 'edit';
        const { embed, components } = buildEditInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Edit → Done
    if (customId.startsWith('profile_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({ content: '✅ Profile editing complete!', embeds: [], components: [] });
    }

    // Edit → Settings transition
    if (customId.startsWith('profile_edit_settings_')) {
        session.type = 'settings';
        const { embed, components } = buildSettingsInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Settings → Back to Edit
    if (customId.startsWith('profile_settings_back_')) {
        session.type = 'edit';
        const { embed, components } = buildEditInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Settings → Toggle Closed Characters
    if (customId.startsWith('profile_settings_closedchar_')) {
        if (!user.settings) user.settings = {};
        user.settings.closedCharAllowed = user.settings.closedCharAllowed !== false ? false : true;
        await user.save();

        const { embed, components } = buildSettingsInterface(user, system, session);
        return await interaction.update({ content: user.settings.closedCharAllowed ? '✅ Closed characters enabled.' : '❌ Closed characters disabled.', embeds: [embed], components });
    }

    // Settings → Privacy Settings
    if (customId.startsWith('profile_settings_privacy_')) {
        if (!system?.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured for your system.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings`)
            .setDescription('Configure who can see your system information.');

        for (const bucket of system.privacyBuckets) {
            const privacy = system.setting?.privacy?.find(p => p.bucket === bucket.name);
            let status = 'Default (visible)';
            if (privacy?.settings?.hidden === false) status = '❌ Hidden';
            else if (privacy?.settings?.hidden === true) status = '✅ Visible';
            embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`profile_privacy_toggle_${sessionId}`).setLabel('Toggle Visibility').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`profile_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Privacy → Toggle
    if (customId.startsWith('profile_privacy_toggle_')) {
        if (!system?.privacyBuckets?.length) {
            return await interaction.reply({ content: '❌ No privacy buckets configured.', ephemeral: true });
        }

        const bucketOptions = system.privacyBuckets.map(b => {
            const privacy = system.setting?.privacy?.find(p => p.bucket === b.name);
            const isHidden = privacy?.settings?.hidden === false;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${b.name} (${isHidden ? 'Hidden' : 'Visible'})`)
                .setValue(b.name)
                .setEmoji(isHidden ? '❌' : '✅');
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`profile_privacy_select_${sessionId}`)
            .setPlaceholder('Select bucket to toggle...')
            .addOptions(bucketOptions);

        return await interaction.update({ content: 'Select a bucket to toggle:', embeds: [], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    }

    // Privacy → Back to Settings
    if (customId.startsWith('profile_privacy_back_')) {
        session.type = 'settings';
        const { embed, components } = buildSettingsInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Quick Status button
    if (customId.startsWith('profile_quick_status_')) {
        const modal = new ModalBuilder()
            .setCustomId(`profile_quick_status_modal_${sessionId}`)
            .setTitle('Update Status');

        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('status')
                .setLabel('Current Status')
                .setStyle(TextInputStyle.Short)
                .setValue(system?.front?.status || '')
                .setPlaceholder('e.g., Working, Relaxing, In class')
                .setRequired(false)
                .setMaxLength(100)
        ));

        return await interaction.showModal(modal);
    }

    // Quick Battery button
    if (customId.startsWith('profile_quick_battery_')) {
        const modal = new ModalBuilder()
            .setCustomId(`profile_quick_battery_modal_${sessionId}`)
            .setTitle('Update Social Battery');

        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('battery')
                .setLabel('Social Battery (0-100)')
                .setStyle(TextInputStyle.Short)
                .setValue(system?.battery !== undefined ? String(system.battery) : '')
                .setPlaceholder('75')
                .setRequired(false)
                .setMaxLength(3)
        ));

        return await interaction.showModal(modal);
    }

    // Quick Caution button
    if (customId.startsWith('profile_quick_caution_')) {
        const modal = new ModalBuilder()
            .setCustomId(`profile_quick_caution_modal_${sessionId}`)
            .setTitle('Update Caution');

        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('caution')
                .setLabel('Status Caution')
                .setStyle(TextInputStyle.Short)
                .setValue(system?.front?.caution || '')
                .setPlaceholder('e.g., Low energy today')
                .setRequired(false)
                .setMaxLength(100)
        ));

        return await interaction.showModal(modal);
    }
}

// ==== SELECT MENU HANDLER ====

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    // Privacy toggle select
    if (interaction.customId.startsWith('profile_privacy_select_')) {
        const user = await User.findById(session.userId);
        const system = session.systemId ? await System.findById(session.systemId) : null;
        const bucketName = interaction.values[0];

        if (!system.setting) system.setting = {};
        if (!system.setting.privacy) system.setting.privacy = [];

        let privacy = system.setting.privacy.find(p => p.bucket === bucketName);
        if (!privacy) {
            privacy = { bucket: bucketName, settings: {} };
            system.setting.privacy.push(privacy);
        }

        privacy.settings.hidden = privacy.settings.hidden === false ? true : false;
        await system.save();

        const embed = new EmbedBuilder()
            .setTitle(`🔒 Privacy Settings`)
            .setDescription('Configure who can see your system information.');

        for (const bucket of system.privacyBuckets) {
            const p = system.setting?.privacy?.find(pr => pr.bucket === bucket.name);
            let status = 'Default (visible)';
            if (p?.settings?.hidden === false) status = '❌ Hidden';
            else if (p?.settings?.hidden === true) status = '✅ Visible';
            embed.addFields({ name: `Bucket: ${bucket.name}`, value: status, inline: false });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`profile_privacy_toggle_${sessionId}`).setLabel('Toggle Visibility').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId(`profile_privacy_back_${sessionId}`).setLabel('Back to Settings').setStyle(ButtonStyle.Danger)
        );

        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;
    const value = interaction.values[0];

    let modal;

    switch (value) {
        case 'basic_info':
            modal = new ModalBuilder().setCustomId(`profile_edit_basic_modal_${sessionId}`).setTitle('Edit Basic Info');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('display_name').setLabel('Display Name').setStyle(TextInputStyle.Short).setValue(user.discord?.name?.display || '').setRequired(false).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pronouns').setLabel('Pronouns (comma-separated)').setStyle(TextInputStyle.Short).setValue(user.pronouns?.join(', ') || '').setPlaceholder('she/her, they/them').setRequired(false).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pronoun_separator').setLabel('Pronoun Separator').setStyle(TextInputStyle.Short).setValue(user.pronounSeperator || '/').setPlaceholder('/').setRequired(false).setMaxLength(5)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bio').setLabel('Bio').setStyle(TextInputStyle.Paragraph).setValue(user.discord?.description || '').setPlaceholder('Tell others about yourself...').setRequired(false).setMaxLength(500))
            );
            break;

        case 'status_info':
            modal = new ModalBuilder().setCustomId(`profile_edit_status_modal_${sessionId}`).setTitle('Edit Current Status');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('status').setLabel('Current Status').setStyle(TextInputStyle.Short).setValue(system?.front?.status || '').setPlaceholder('e.g., Working, Relaxing').setRequired(false).setMaxLength(100)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('battery').setLabel('Social Battery (0-100)').setStyle(TextInputStyle.Short).setValue(system?.battery !== undefined ? String(system.battery) : '').setPlaceholder('75').setRequired(false).setMaxLength(3)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caution').setLabel('Status Caution (optional)').setStyle(TextInputStyle.Short).setValue(system?.front?.caution || '').setPlaceholder('e.g., Low energy today').setRequired(false).setMaxLength(100))
            );
            break;

        case 'proxy_info':
            modal = new ModalBuilder().setCustomId(`profile_edit_proxy_modal_${sessionId}`).setTitle('Edit Proxy Settings');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxy_style').setLabel('Auto-proxy Style (off/last/front/[name])').setStyle(TextInputStyle.Short).setValue(system?.proxy?.style || 'off').setPlaceholder('off, last, front, or entity name').setRequired(false).setMaxLength(50)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('proxy_break').setLabel('On Proxy Break? (yes/no)').setStyle(TextInputStyle.Short).setValue(system?.proxy?.break ? 'yes' : 'no').setPlaceholder('yes or no').setRequired(false).setMaxLength(3))
            );
            break;

        default:
            return await interaction.reply({ content: '❌ Unknown option.', ephemeral: true });
    }

    await interaction.showModal(modal);
}

// ==== MODAL SUBMIT HANDLER ====

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;

    // Basic info modal
    if (interaction.customId.startsWith('profile_edit_basic_modal_')) {
        const displayName = interaction.fields.getTextInputValue('display_name');
        const pronounsInput = interaction.fields.getTextInputValue('pronouns');
        const pronounSeparator = interaction.fields.getTextInputValue('pronoun_separator');
        const bio = interaction.fields.getTextInputValue('bio');

        if (!user.discord) user.discord = { name: {} };
        if (!user.discord.name) user.discord.name = {};

        if (displayName) user.discord.name.display = displayName;
        if (pronounsInput) user.pronouns = utils.parseCommaSeparated(pronounsInput);
        if (pronounSeparator) user.pronounSeperator = pronounSeparator;
        if (bio !== undefined) user.discord.description = bio || undefined;

        await user.save();

        const { embed, components } = buildEditInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Status info modal
    if (interaction.customId.startsWith('profile_edit_status_modal_')) {
        const status = interaction.fields.getTextInputValue('status');
        const batteryInput = interaction.fields.getTextInputValue('battery');
        const caution = interaction.fields.getTextInputValue('caution');

        if (system) {
            if (!system.front) system.front = {};
            system.front.status = status || undefined;
            system.front.caution = caution || undefined;

            if (batteryInput) {
                const batteryNum = parseInt(batteryInput);
                if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) system.battery = batteryNum;
            } else {
                system.battery = undefined;
            }

            await system.save();
        }

        const { embed, components } = buildEditInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Proxy info modal
    if (interaction.customId.startsWith('profile_edit_proxy_modal_')) {
        const proxyStyle = interaction.fields.getTextInputValue('proxy_style');
        const proxyBreak = interaction.fields.getTextInputValue('proxy_break');

        if (system) {
            if (!system.proxy) system.proxy = {};

            const validStyles = ['off', 'last', 'front'];
            if (validStyles.includes(proxyStyle?.toLowerCase())) {
                system.proxy.style = proxyStyle.toLowerCase();
            } else if (proxyStyle) {
                system.proxy.style = proxyStyle;
            }

            system.proxy.break = proxyBreak?.toLowerCase() === 'yes';
            await system.save();
        }

        const { embed, components } = buildEditInterface(user, system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Quick status modal
    if (interaction.customId.startsWith('profile_quick_status_modal_')) {
        const status = interaction.fields.getTextInputValue('status');

        if (system) {
            if (!system.front) system.front = {};
            system.front.status = status || undefined;
            await system.save();
        }

        return await interaction.update({
            content: status ? `✅ Status updated to: *${status}*` : '✅ Status cleared.',
            embeds: [],
            components: []
        });
    }

    // Quick battery modal
    if (interaction.customId.startsWith('profile_quick_battery_modal_')) {
        const batteryInput = interaction.fields.getTextInputValue('battery');

        if (system) {
            if (batteryInput) {
                const batteryNum = parseInt(batteryInput);
                if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
                    system.battery = batteryNum;
                    await system.save();

                    const batteryEmoji = utils.getBatteryEmoji(batteryNum);
                    return await interaction.update({
                        content: `✅ Social battery updated to: ${batteryEmoji} ${batteryNum}%`,
                        embeds: [],
                        components: []
                    });
                }
            } else {
                system.battery = undefined;
                await system.save();

                return await interaction.update({
                    content: '✅ Social battery cleared.',
                    embeds: [],
                    components: []
                });
            }
        }

        return await interaction.update({
            content: '❌ Invalid battery value. Please enter a number between 0-100.',
            embeds: [],
            components: []
        });
    }

    // Quick caution modal
    if (interaction.customId.startsWith('profile_quick_caution_modal_')) {
        const caution = interaction.fields.getTextInputValue('caution');

        if (system) {
            if (!system.front) system.front = {};
            system.front.caution = caution || undefined;
            await system.save();
        }

        return await interaction.update({
            content: caution ? `✅ Caution updated: ${caution}` : '✅ Caution cleared.',
            embeds: [],
            components: []
        });
    }
}

// ==== HELPER FUNCTIONS ====
