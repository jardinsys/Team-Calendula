// (/profile) - Systemiser Profile Command

// (/profile show) (click button to show all info in ephemeral)
// (/profile show)

// (/profile edit)
// (/profile settings)

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
const System = require('../../schemas/system');
const User = require('../../schemas/user');

// Import shared utilities
const utils = require('../functions/bot_utils');

// Constants
const ENTITY_COLORS = utils.ENTITY_COLORS;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View and manage your profile')
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('View your profile or another user\'s profile')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to view'))
            .addStringOption(opt => opt
                .setName('userid')
                .setDescription('Discord User ID (for users outside the server)')))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit your profile'))
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Quick update your current status')
            .addStringOption(opt => opt
                .setName('text')
                .setDescription('Your current status')
                .setRequired(true)
                .setMaxLength(100)))
        .addSubcommand(sub => sub
            .setName('battery')
            .setDescription('Quick update your social battery')
            .addIntegerOption(opt => opt
                .setName('level')
                .setDescription('Social battery level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) {
            return utils.handleNewUserFlow(interaction, 'profile');
        }

        switch (subcommand) {
            case 'show':
                return handleShow(interaction, user, system);
            case 'edit':
                return handleEdit(interaction, user, system);
            case 'status':
                return handleQuickStatus(interaction, user, system);
            case 'battery':
                return handleQuickBattery(interaction, user, system);
            default:
                return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    },

    // Export handlers for bot.js
    handleButtonInteraction,
    handleSelectMenu,
    handleModalSubmit
};

// ============================================
// SHOW - View profile
// ============================================

async function handleShow(interaction, currentUser, currentSystem) {
    const targetDiscordUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let user = currentUser;
    let system = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    // If viewing another user's profile
    if (targetDiscordUser || targetUserId) {
        isOwner = false;
        const discordId = targetDiscordUser?.id || targetUserId;

        user = await User.findOne({ discordID: discordId });

        if (!user) {
            return interaction.reply({
                content: '❌ This user hasn\'t set up a profile yet.',
                ephemeral: true
            });
        }

        if (user.systemID) {
            system = await System.findById(user.systemID);
        }

        // Check if blocked
        if (currentUser && utils.isBlocked(user, interaction.user.id, currentUser.friendID)) {
            return interaction.reply({
                content: '❌ This user\'s profile is not available.',
                ephemeral: true
            });
        }

        // Get privacy bucket for system data visibility
        if (system) {
            privacyBucket = utils.getPrivacyBucket(system, interaction.user.id, interaction.guildId);
        }
    }

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    await interaction.deferReply({ ephemeral: !isOwner });

    const embed = await buildProfileEmbed(user, system, interaction, isOwner, privacyBucket, closedCharAllowed);

    // Build action buttons (only for owner)
    const components = [];
    if (isOwner) {
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`profile_edit_${user._id}`)
                .setLabel('Edit Profile')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId(`profile_quick_status_${user._id}`)
                .setLabel('Update Status')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💬'),
            new ButtonBuilder()
                .setCustomId(`profile_quick_battery_${user._id}`)
                .setLabel('Update Battery')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔋')
        );
        components.push(actionRow);
    }

    return interaction.editReply({ embeds: [embed], components });
}

// ============================================
// EDIT - Edit profile interface
// ============================================

async function handleEdit(interaction, user, system) {
    const sessionId = utils.generateSessionId(interaction.user.id);

    utils.setSession(sessionId, {
        userId: user._id.toString(),
        systemId: system?._id?.toString(),
        type: 'profile_edit'
    });

    const embed = buildEditInterface(user, system, sessionId);
    const components = buildEditComponents(sessionId);

    return interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// ============================================
// QUICK STATUS - Quick status update
// ============================================

async function handleQuickStatus(interaction, user, system) {
    const statusText = interaction.options.getString('text');

    if (!system) {
        return interaction.reply({
            content: '❌ No profile data found. Use `/profile edit` to set up your profile.',
            ephemeral: true
        });
    }

    if (!system.front) system.front = {};
    system.front.status = statusText;
    await system.save();

    return interaction.reply({
        content: `✅ Status updated to: *${statusText}*`,
        ephemeral: true
    });
}

// ============================================
// QUICK BATTERY - Quick battery update
// ============================================

async function handleQuickBattery(interaction, user, system) {
    const batteryLevel = interaction.options.getInteger('level');

    if (!system) {
        return interaction.reply({
            content: '❌ No profile data found. Use `/profile edit` to set up your profile.',
            ephemeral: true
        });
    }

    system.battery = batteryLevel;
    await system.save();

    const batteryEmoji = getBatteryEmoji(batteryLevel);
    return interaction.reply({
        content: `✅ Social battery updated to: ${batteryEmoji} ${batteryLevel}%`,
        ephemeral: true
    });
}

// ============================================
// BUILD PROFILE EMBED
// ============================================

async function buildProfileEmbed(user, system, interaction, isOwner, privacyBucket = null, closedCharAllowed = true) {
    const displayName = user.discord?.name?.display || interaction.user?.displayName || 'Unknown';

    const embed = new EmbedBuilder()
        .setTitle(`👤 ${displayName}'s Profile`)
        .setThumbnail(interaction.user?.displayAvatarURL() || null)
        .setTimestamp();

    // Use system color if available
    const profileColor = utils.getSystemEmbedColor(system);
    if (profileColor) embed.setColor(profileColor);

    // Description from user
    if (user.discord?.description) {
        embed.setDescription(user.discord.description);
    }

    // Basic Info field
    let basicInfo = '';
    if (user.pronouns?.length > 0) {
        const separator = user.pronounSeperator || '/';
        basicInfo += `**Pronouns:** ${user.pronouns.join(separator)}\n`;
    }
    if (user.friendID && isOwner) {
        // Only show friend ID to owner
        basicInfo += `**Friend ID:** \`${user.friendID}\`\n`;
    }
    if (basicInfo) {
        embed.addFields({ name: '📋 Info', value: basicInfo.trim(), inline: true });
    }

    // Current Status field (from system.front) - check privacy
    if (system) {
        // Check if status/front info should be shown based on privacy
        const systemPrivacy = system.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
        const showFrontInfo = isOwner || systemPrivacy?.settings?.front?.hidden !== true;

        if (showFrontInfo) {
            let statusInfo = '';
            if (system.front?.status) {
                statusInfo += `**Status:** ${system.front.status}\n`;
            }
            if (system.battery !== undefined && system.battery !== null) {
                const batteryEmoji = getBatteryEmoji(system.battery);
                statusInfo += `**Social Battery:** ${batteryEmoji} ${system.battery}%\n`;
            }
            if (system.front?.caution) {
                statusInfo += `**⚠️ Caution:** ${system.front.caution}\n`;
            }
            if (statusInfo) {
                embed.addFields({ name: '💭 Current Status', value: statusInfo.trim(), inline: true });
            }
        }
    }

    // Proxy Settings field (simplified, from system) - only for owner
    if (system && isOwner) {
        let proxyInfo = '';
        const proxyStyle = system.proxy?.style || 'off';
        proxyInfo += `**Auto-proxy:** ${proxyStyle}\n`;
        if (system.proxy?.break) {
            proxyInfo += `**🛑 On Break:** Yes\n`;
        }
        if (proxyInfo) {
            embed.addFields({ name: '💬 Proxy', value: proxyInfo.trim(), inline: true });
        }
    }

    // Account Info field
    let accountInfo = '';
    if (user.joinedAt) {
        const joinedTimestamp = Math.floor(new Date(user.joinedAt).getTime() / 1000);
        accountInfo += `**Joined:** <t:${joinedTimestamp}:R>\n`;
    }
    if (user.friends?.length > 0 && isOwner) {
        // Only show friend count to owner
        accountInfo += `**Friends:** ${user.friends.length}\n`;
    }
    if (accountInfo) {
        embed.addFields({ name: '📊 Account', value: accountInfo.trim(), inline: true });
    }

    // Footer
    embed.setFooter({
        text: isOwner ? 'Your profile' : `${displayName}'s profile`
    });

    return embed;
}

// ============================================
// BUILD EDIT INTERFACE
// ============================================

function buildEditInterface(user, system, sessionId) {
    const displayName = user.discord?.name?.display || 'Unknown';

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editing: ${displayName}'s Profile`)
        .setDescription('Select what you would like to edit from the dropdown menu below.');

    // Use system color if available
    const editColor = utils.getSystemEmbedColor(system);
    if (editColor) embed.setColor(editColor);

    // Show current values
    let currentValues = '';

    if (user.discord?.name?.display) {
        currentValues += `**Display Name:** ${user.discord.name.display}\n`;
    }
    if (user.pronouns?.length > 0) {
        currentValues += `**Pronouns:** ${user.pronouns.join(user.pronounSeperator || '/')}\n`;
    }
    if (user.discord?.description) {
        const desc = user.discord.description.length > 50
            ? user.discord.description.substring(0, 47) + '...'
            : user.discord.description;
        currentValues += `**Bio:** ${desc}\n`;
    }

    if (system) {
        if (system.front?.status) {
            currentValues += `**Status:** ${system.front.status}\n`;
        }
        if (system.battery !== undefined) {
            currentValues += `**Battery:** ${system.battery}%\n`;
        }
    }

    if (currentValues) {
        embed.addFields({ name: '📋 Current Values', value: currentValues.trim(), inline: false });
    }

    return embed;
}

function buildEditComponents(sessionId) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`profile_edit_select_${sessionId}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Basic Info')
                .setDescription('Edit display name, pronouns, bio')
                .setValue('basic_info')
                .setEmoji('📋'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Current Status')
                .setDescription('Edit status and social battery')
                .setValue('status_info')
                .setEmoji('💭'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Proxy Settings')
                .setDescription('Edit auto-proxy style and break status')
                .setValue('proxy_info')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Privacy Settings')
                .setDescription('Edit closed character and friend settings')
                .setValue('privacy_info')
                .setEmoji('🔒')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_edit_done_${sessionId}`)
            .setLabel('Done')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    );

    return [selectRow, buttonRow];
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle edit button from show
    if (customId.startsWith('profile_edit_') && !customId.includes('select') && !customId.includes('done')) {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!user) {
            return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        }

        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, {
            userId: user._id.toString(),
            systemId: system?._id?.toString(),
            type: 'profile_edit'
        });

        const embed = buildEditInterface(user, system, sessionId);
        const components = buildEditComponents(sessionId);

        return interaction.update({ embeds: [embed], components });
    }

    // Handle quick status button
    if (customId.startsWith('profile_quick_status_')) {
        const sessionId = utils.generateSessionId(interaction.user.id);
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);

        utils.setSession(sessionId, {
            userId: user._id.toString(),
            systemId: system?._id?.toString(),
            type: 'profile_quick_status'
        });

        const modal = new ModalBuilder()
            .setCustomId(`profile_quick_status_modal_${sessionId}`)
            .setTitle('Update Status');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('status')
                    .setLabel('Current Status')
                    .setStyle(TextInputStyle.Short)
                    .setValue(system?.front?.status || '')
                    .setPlaceholder('e.g., Working, Relaxing, In class')
                    .setRequired(false)
                    .setMaxLength(100)
            )
        );

        return interaction.showModal(modal);
    }

    // Handle quick battery button
    if (customId.startsWith('profile_quick_battery_')) {
        const sessionId = utils.generateSessionId(interaction.user.id);
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);

        utils.setSession(sessionId, {
            userId: user._id.toString(),
            systemId: system?._id?.toString(),
            type: 'profile_quick_battery'
        });

        const modal = new ModalBuilder()
            .setCustomId(`profile_quick_battery_modal_${sessionId}`)
            .setTitle('Update Social Battery');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('battery')
                    .setLabel('Social Battery (0-100)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(system?.battery !== undefined ? String(system.battery) : '')
                    .setPlaceholder('75')
                    .setRequired(false)
                    .setMaxLength(3)
            )
        );

        return interaction.showModal(modal);
    }

    // Handle done button
    if (customId.startsWith('profile_edit_done_')) {
        const sessionId = utils.extractSessionId(customId);
        utils.deleteSession(sessionId);

        return interaction.update({
            content: '✅ Profile editing complete!',
            embeds: [],
            components: []
        });
    }
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const customId = interaction.customId;
    const value = interaction.values[0];

    if (!customId.startsWith('profile_edit_select_')) return;

    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return interaction.reply({
            content: '❌ Session expired. Please try again.',
            ephemeral: true
        });
    }

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;

    let modal;

    switch (value) {
        case 'basic_info':
            modal = new ModalBuilder()
                .setCustomId(`profile_edit_basic_modal_${sessionId}`)
                .setTitle('Edit Basic Info');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('display_name')
                        .setLabel('Display Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(user.discord?.name?.display || '')
                        .setPlaceholder('Your display name')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pronouns')
                        .setLabel('Pronouns (comma-separated)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(user.pronouns?.join(', ') || '')
                        .setPlaceholder('she/her, they/them')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pronoun_separator')
                        .setLabel('Pronoun Separator')
                        .setStyle(TextInputStyle.Short)
                        .setValue(user.pronounSeperator || '/')
                        .setPlaceholder('/')
                        .setRequired(false)
                        .setMaxLength(5)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('bio')
                        .setLabel('Bio')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(user.discord?.description || '')
                        .setPlaceholder('Tell others about yourself...')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
            break;

        case 'status_info':
            modal = new ModalBuilder()
                .setCustomId(`profile_edit_status_modal_${sessionId}`)
                .setTitle('Edit Current Status');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('status')
                        .setLabel('Current Status')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system?.front?.status || '')
                        .setPlaceholder('e.g., Working, Relaxing, In class')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('battery')
                        .setLabel('Social Battery (0-100)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system?.battery !== undefined ? String(system.battery) : '')
                        .setPlaceholder('75')
                        .setRequired(false)
                        .setMaxLength(3)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('caution')
                        .setLabel('Status Caution (optional warning)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system?.front?.caution || '')
                        .setPlaceholder('e.g., Low energy today')
                        .setRequired(false)
                        .setMaxLength(100)
                )
            );
            break;

        case 'proxy_info':
            modal = new ModalBuilder()
                .setCustomId(`profile_edit_proxy_modal_${sessionId}`)
                .setTitle('Edit Proxy Settings');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('proxy_style')
                        .setLabel('Auto-proxy Style (off/last/front/[name])')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system?.proxy?.style || 'off')
                        .setPlaceholder('off, last, front, or an entity name')
                        .setRequired(false)
                        .setMaxLength(50)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('proxy_break')
                        .setLabel('On Proxy Break? (yes/no)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system?.proxy?.break ? 'yes' : 'no')
                        .setPlaceholder('yes or no')
                        .setRequired(false)
                        .setMaxLength(3)
                )
            );
            break;

        case 'privacy_info':
            modal = new ModalBuilder()
                .setCustomId(`profile_edit_privacy_modal_${sessionId}`)
                .setTitle('Edit Privacy Settings');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('closed_char')
                        .setLabel('Allow Closed Characters? (yes/no)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(user.settings?.closedCharAllowed !== false ? 'yes' : 'no')
                        .setPlaceholder('yes or no')
                        .setRequired(false)
                        .setMaxLength(3)
                )
            );
            break;

        default:
            return;
    }

    return interaction.showModal(modal);
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return interaction.reply({
            content: '❌ Session expired. Please try again.',
            ephemeral: true
        });
    }

    const user = await User.findById(session.userId);
    const system = session.systemId ? await System.findById(session.systemId) : null;

    // Handle basic info modal
    if (interaction.customId.startsWith('profile_edit_basic_modal_')) {
        const displayName = interaction.fields.getTextInputValue('display_name');
        const pronounsInput = interaction.fields.getTextInputValue('pronouns');
        const pronounSeparator = interaction.fields.getTextInputValue('pronoun_separator');
        const bio = interaction.fields.getTextInputValue('bio');

        // Update user
        if (!user.discord) user.discord = { name: {} };
        if (!user.discord.name) user.discord.name = {};

        if (displayName) user.discord.name.display = displayName;
        if (pronounsInput) {
            user.pronouns = utils.parseCommaSeparated(pronounsInput);
        }
        if (pronounSeparator) user.pronounSeperator = pronounSeparator;
        if (bio !== undefined) user.discord.description = bio || undefined;

        await user.save();

        // Return to edit interface
        const embed = buildEditInterface(user, system, sessionId);
        const components = buildEditComponents(sessionId);
        return interaction.update({ embeds: [embed], components });
    }

    // Handle status info modal
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
                if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
                    system.battery = batteryNum;
                }
            } else {
                system.battery = undefined;
            }

            await system.save();
        }

        const embed = buildEditInterface(user, system, sessionId);
        const components = buildEditComponents(sessionId);
        return interaction.update({ embeds: [embed], components });
    }

    // Handle proxy info modal
    if (interaction.customId.startsWith('profile_edit_proxy_modal_')) {
        const proxyStyle = interaction.fields.getTextInputValue('proxy_style');
        const proxyBreak = interaction.fields.getTextInputValue('proxy_break');

        if (system) {
            if (!system.proxy) system.proxy = {};

            // Validate proxy style
            const validStyles = ['off', 'last', 'front'];
            if (validStyles.includes(proxyStyle?.toLowerCase())) {
                system.proxy.style = proxyStyle.toLowerCase();
            } else if (proxyStyle) {
                // Check if it's a valid entity name (specify mode)
                const { entity } = await utils.findEntityByName(proxyStyle, system);
                if (entity) {
                    system.proxy.style = proxyStyle;
                } else {
                    // Invalid entity name, keep as is or set to off
                    system.proxy.style = system.proxy.style || 'off';
                }
            }

            system.proxy.break = proxyBreak?.toLowerCase() === 'yes';

            await system.save();
        }

        const embed = buildEditInterface(user, system, sessionId);
        const components = buildEditComponents(sessionId);
        return interaction.update({ embeds: [embed], components });
    }

    // Handle privacy info modal
    if (interaction.customId.startsWith('profile_edit_privacy_modal_')) {
        const closedChar = interaction.fields.getTextInputValue('closed_char');

        if (!user.settings) user.settings = {};
        user.settings.closedCharAllowed = closedChar?.toLowerCase() !== 'no';

        await user.save();

        const embed = buildEditInterface(user, system, sessionId);
        const components = buildEditComponents(sessionId);
        return interaction.update({ embeds: [embed], components });
    }

    // Handle quick status modal
    if (interaction.customId.startsWith('profile_quick_status_modal_')) {
        const status = interaction.fields.getTextInputValue('status');

        if (system) {
            if (!system.front) system.front = {};
            system.front.status = status || undefined;
            await system.save();
        }

        return interaction.update({
            content: status ? `✅ Status updated to: *${status}*` : '✅ Status cleared.',
            embeds: [],
            components: []
        });
    }

    // Handle quick battery modal
    if (interaction.customId.startsWith('profile_quick_battery_modal_')) {
        const batteryInput = interaction.fields.getTextInputValue('battery');

        if (system) {
            if (batteryInput) {
                const batteryNum = parseInt(batteryInput);
                if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
                    system.battery = batteryNum;
                    await system.save();

                    const batteryEmoji = getBatteryEmoji(batteryNum);
                    return interaction.update({
                        content: `✅ Social battery updated to: ${batteryEmoji} ${batteryNum}%`,
                        embeds: [],
                        components: []
                    });
                }
            } else {
                system.battery = undefined;
                await system.save();

                return interaction.update({
                    content: '✅ Social battery cleared.',
                    embeds: [],
                    components: []
                });
            }
        }

        return interaction.update({
            content: '❌ Invalid battery value. Please enter a number between 0-100.',
            embeds: [],
            components: []
        });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get battery emoji based on percentage
 */
function getBatteryEmoji(battery) {
    if (battery >= 80) return '🔋';
    if (battery >= 60) return '🔋';
    if (battery >= 40) return '🔋';
    if (battery >= 20) return '🪫';
    return '🪫';
}