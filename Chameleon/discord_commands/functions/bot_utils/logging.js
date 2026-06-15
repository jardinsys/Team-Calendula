// Guild Logging Utilities
// Discord guild log channel posting and log embed builders

const Guild = require('../../../schemas/guild');
const { EmbedBuilder } = require('discord.js');

const constants = require('./constants');
const { ENTITY_COLORS } = constants;

// Local capitalize helper (avoids circular deps)
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Send a log entry to the guild's configured log channel.
 * @param {string} guildId - Discord guild ID
 * @param {string} eventType - 'proxy' | 'edit' | 'delete' | 'reproxy'
 * @param {Object} logData - Event data for the embed
 * @param {Client} client - Discord.js client
 */
async function sendGuildLog(guildId, eventType, logData, client) {
    try {
        let guildDoc = await Guild.findOne({ discordId: guildId });
        if (!guildDoc) return;

        const logChannelId = guildDoc.channels?.logChannel;
        if (!logChannelId) return;

        const logEvents = guildDoc.channels?.logEvents || {};
        if (eventType === 'proxy' && logEvents.proxy === false) return;
        if (eventType === 'edit' && !logEvents.edit) return;
        if (eventType === 'delete' && !logEvents.delete) return;
        if (eventType === 'reproxy' && !logEvents.reproxy) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const embed = buildLogEmbed(eventType, logData);
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[GuildLog] Error sending log:', err.message);
    }
}

/**
 * Build a log embed for the given event type.
 * @param {string} eventType - 'proxy' | 'edit' | 'delete' | 'reproxy'
 * @param {Object} data - Event data
 * @returns {EmbedBuilder}
 */
function buildLogEmbed(eventType, data) {
    const embed = new EmbedBuilder().setTimestamp();

    switch (eventType) {
        case 'proxy': {
            const avatarUrl = data.avatarUrl || null;
            const displayName = data.displayName || data.fallbackDisplayName || 'Unknown';
            const entityName = data.entity?.name?.display || data.entity?.name?.indexable || data.fallbackDisplayName || 'Unknown';
            const systemName = data.system?.name?.display || data.system?.name?.indexable || data.fallbackDisplayName || 'Unknown';
            const content = (data.content || '').substring(0, 1024);
            const color = data.entity?.color || data.system?.color || ENTITY_COLORS.success;

            embed
                .setColor(color)
                .setTitle('📤 Message Proxied')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.type)}: **${entityName}**`, inline: true },
                    { name: 'System', value: systemName, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Content', value: content || '*empty*', inline: false }
                )
                .setFooter({ text: `Displayed as: ${displayName}` });

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'edit': {
            const avatarUrl = data.avatarUrl || null;
            const entityName = data.entityName || data.fallbackDisplayName || 'Unknown';
            const oldContent = (data.oldContent || '').substring(0, 1024);
            const newContent = (data.newContent || '').substring(0, 1024);
            const color = ENTITY_COLORS.group;

            embed
                .setColor(color)
                .setTitle('✏️ Message Edited')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.entityType)}: **${entityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Original', value: oldContent || '*empty*', inline: false },
                    { name: 'New', value: newContent || '*empty*', inline: false }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'delete': {
            const avatarUrl = data.avatarUrl || null;
            const entityName = data.entityName || data.fallbackDisplayName || 'Unknown';
            const content = (data.content || '').substring(0, 1024);
            const color = ENTITY_COLORS.error;

            embed
                .setColor(color)
                .setTitle('🗑️ Message Deleted')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.entityType)}: **${entityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Content', value: content || '*empty*', inline: false }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'reproxy': {
            const avatarUrl = data.avatarUrl || null;
            const oldEntityName = data.oldEntityName || data.fallbackDisplayName || 'Unknown';
            const newEntityName = data.newEntityName || data.fallbackDisplayName || 'Unknown';
            const color = ENTITY_COLORS.info;

            embed
                .setColor(color)
                .setTitle('🔄 Message Reproxied')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'From', value: `${capitalize(data.oldEntityType)}: **${oldEntityName}**`, inline: true },
                    { name: 'To', value: `${capitalize(data.newEntityType)}: **${newEntityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }
    }

    return embed;
}

module.exports = {
    sendGuildLog,
    buildLogEmbed,
};