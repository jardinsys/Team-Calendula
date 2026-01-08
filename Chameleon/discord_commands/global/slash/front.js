// (/front) - Systemiser Front Command
// Shows who is currently fronting by layers with statuses

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const User = require('../../schemas/user');
const { Shift } = require('../../schemas/front');

// Import shared utilities
const utils = require('../functions/bot_utils');

// Constants
const ENTITY_COLORS = utils.ENTITY_COLORS;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('front')
        .setDescription('View who is currently fronting')
        .addUserOption(opt => opt
            .setName('user')
            .setDescription('View front for another user'))
        .addStringOption(opt => opt
            .setName('userid')
            .setDescription('Discord User ID (for users outside the server)')),

    async execute(interaction) {
        // Determine whose front to show
        let targetUser = interaction.options.getUser('user');
        let targetUserId = interaction.options.getString('userid');

        // Default to the command user
        if (!targetUser && !targetUserId) {
            targetUserId = interaction.user.id;
        } else if (targetUser) {
            targetUserId = targetUser.id;
        }

        // Get the user and system
        const user = await User.findOne({ discordID: targetUserId });

        if (!user) {
            if (targetUserId === interaction.user.id) {
                return utils.handleNewUserFlow(interaction, 'front');
            }
            return interaction.reply({
                content: '❌ That user hasn\'t set up a system yet.',
                ephemeral: true
            });
        }

        const system = await System.findById(user.systemID);
        if (!system) {
            return interaction.reply({
                content: '❌ System not found.',
                ephemeral: true
            });
        }

        // Check privacy (if viewing another user's front)
        const isOwner = targetUserId === interaction.user.id;

        if (!isOwner) {
            // Get current user for blocked check
            const currentUser = await User.findOne({ discordID: interaction.user.id });

            // Check if blocked
            if (currentUser && utils.isBlocked(user, interaction.user.id, currentUser.friendID)) {
                return interaction.reply({
                    content: '❌ This user\'s front information is not available.',
                    ephemeral: true
                });
            }

            // Check privacy bucket
            const privacyBucket = utils.getPrivacyBucket(system, interaction.user.id, interaction.guildId);

            // Check if front info is hidden for this privacy level
            const systemPrivacy = system.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
            if (systemPrivacy?.settings?.front?.hidden === true) {
                return interaction.reply({
                    content: '❌ This user\'s front information is not available.',
                    ephemeral: true
                });
            }
        }

        const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

        await interaction.deferReply();

        // Build the front embed
        const embed = await buildFrontEmbed(system, user, interaction, isOwner, closedCharAllowed);

        // Build action buttons (only for owner)
        const components = [];
        if (isOwner) {
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`front_switch_${system._id}`)
                    .setLabel('Switch')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId(`front_refresh_${system._id}`)
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔃')
            );
            components.push(actionRow);
        }

        return interaction.editReply({ embeds: [embed], components });
    },

    // Export handlers for bot.js
    handleButtonInteraction
};

// ============================================
// BUILD FRONT EMBED
// ============================================

async function buildFrontEmbed(system, user, interaction, isOwner, closedCharAllowed = true) {
    // Get display name - respect closed character settings
    let systemName;
    if (!closedCharAllowed && system.name?.closedNameDisplay) {
        systemName = system.name.closedNameDisplay;
    } else {
        systemName = system.name?.display || system.name?.indexable || 'Unknown System';
    }
    const userName = user.discord?.name?.display || interaction.user?.displayName || 'Unknown User';

    const embed = new EmbedBuilder()
        .setTitle(`🎭 Currently Fronting for ${systemName}`)
        .setTimestamp();

    // Use system color if available
    const frontColor = utils.getSystemEmbedColor(system);
    if (frontColor) embed.setColor(frontColor);

    // Set thumbnail to system avatar
    if (system.avatar?.url || system.discord?.image?.avatar?.url) {
        embed.setThumbnail(system.avatar?.url || system.discord?.image?.avatar?.url);
    }

    // Build description with main status and battery
    let description = '';

    if (system.front?.status) {
        description += `**Status:** ${system.front.status}\n`;
    }

    if (system.battery !== undefined && system.battery !== null) {
        const batteryEmoji = getBatteryEmoji(system.battery);
        description += `**Social Battery:** ${batteryEmoji} ${system.battery}%\n`;
    }

    if (system.front?.caution) {
        description += `**⚠️ Caution:** ${system.front.caution}\n`;
    }

    if (description) {
        embed.setDescription(description.trim());
    }

    // Get fronters by layer
    const layers = system.front?.layers || [];

    if (layers.length === 0) {
        embed.addFields({
            name: '📭 No Front Data',
            value: 'No one is currently marked as fronting.\nUse `/switch in` to set the current front.',
            inline: false
        });
    } else {
        // Add a field for each layer
        for (const layer of layers) {
            const layerName = layer.name || 'Front';
            const fronters = [];

            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);

                // Only show active (not ended) shifts
                if (!shift || shift.endTime) continue;

                // Get the entity for more details
                const entityInfo = await getEntityInfo(shift.ID, shift.s_type, system, closedCharAllowed);
                const currentStatus = shift.statuses?.[shift.statuses.length - 1];

                // Build fronter line - use closedNameDisplay if needed
                const emoji = shift.s_type === 'alter' ? '🎭' : (shift.s_type === 'state' ? '🔄' : '👥');
                const displayName = entityInfo?.name || shift.type_name;
                let fronterLine = `${emoji} **${displayName}**`;

                // Add pronouns if available
                if (entityInfo?.pronouns?.length > 0) {
                    fronterLine += ` (${entityInfo.pronouns.join('/')})`;
                }

                // Add status if available
                if (currentStatus?.status) {
                    fronterLine += `\n   └ *${currentStatus.status}*`;
                }

                // Add duration
                const duration = getShiftDuration(shift.startTime);
                fronterLine += `\n   └ 🕐 ${duration}`;

                fronters.push(fronterLine);
            }

            // Add layer field
            const layerColor = layer.color ? `🎨 ` : '';
            embed.addFields({
                name: `${layerColor}${layerName}`,
                value: fronters.length > 0 ? fronters.join('\n\n') : '*Empty*',
                inline: layers.length > 1 // Inline if multiple layers
            });
        }
    }

    // Footer with user info
    embed.setFooter({
        text: isOwner ? 'Your system' : `${userName}'s system`,
        iconURL: interaction.user.displayAvatarURL()
    });

    return embed;
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle switch button - redirect to switch command
    if (customId.startsWith('front_switch_')) {
        // Import and execute switch command's switch-in handler
        // For now, just inform user to use the command
        return interaction.reply({
            content: '💡 Use `/switch in` to change who is fronting.',
            ephemeral: true
        });
    }

    // Handle refresh button
    if (customId.startsWith('front_refresh_')) {
        const systemId = customId.replace('front_refresh_', '');
        const system = await System.findById(systemId);

        if (!system) {
            return interaction.reply({
                content: '❌ System not found.',
                ephemeral: true
            });
        }

        // Check ownership
        const user = await User.findOne({ systemID: systemId, discordID: interaction.user.id });
        if (!user) {
            return interaction.reply({
                content: '❌ You can only refresh your own front view.',
                ephemeral: true
            });
        }

        // Rebuild the embed
        const embed = await buildFrontEmbed(system, user, interaction, true);

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`front_switch_${system._id}`)
                .setLabel('Switch')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId(`front_refresh_${system._id}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔃')
        );

        return interaction.update({ embeds: [embed], components: [actionRow] });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get entity info for a fronter
 */
async function getEntityInfo(entityId, type, system, closedCharAllowed = true) {
    try {
        let entity = null;

        switch (type) {
            case 'alter':
                entity = await Alter.findById(entityId);
                break;
            case 'state':
                entity = await State.findById(entityId);
                break;
            case 'group':
                entity = await Group.findById(entityId);
                break;
        }

        if (!entity) return null;

        // Respect closedCharAllowed for name display
        let displayName;
        if (!closedCharAllowed && entity.name?.closedNameDisplay) {
            displayName = entity.name.closedNameDisplay;
        } else {
            displayName = entity.name?.display || entity.name?.indexable || 'Unknown';
        }

        return {
            name: displayName,
            pronouns: entity.pronouns || entity.identity?.pronouns || [],
            avatar: entity.avatar?.url || entity.discord?.image?.avatar?.url,
            color: entity.color
        };
    } catch (error) {
        return null;
    }
}

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

/**
 * Get human-readable shift duration
 */
function getShiftDuration(startTime) {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now - start;

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
}