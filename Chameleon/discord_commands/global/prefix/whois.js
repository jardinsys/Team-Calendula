// sys!whois - Look up who sent a proxied message
// Prefix equivalent of /whois slash command
//
// USAGE:
//   sys!whois <message_id>           - Look up by message ID
//   sys!whois <message_link>         - Look up by message link
//   (or reply to a proxied message)

const { EmbedBuilder } = require('discord.js');
const Message = require('../../../schemas/message');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'whois',
    aliases: ['who', 'lookup'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);

        // Determine target message ID
        let targetMessageId = null;

        // Check for reply
        if (message.reference) {
            targetMessageId = message.reference.messageId;
        }
        // Check first arg for message ID or link
        else if (parsed._positional[0]) {
            targetMessageId = extractMessageId(parsed._positional[0]);
        }

        if (!targetMessageId) {
            return utils.error(message, 'Please provide a message ID, link, or reply to a proxied message.\n\nUsage: `sys!whois <message_id|link>` or reply to a message.');
        }

        // Look up the message in our database
        const msgRecord = await Message.findOne({
            discord_webhook_message_id: targetMessageId
        });

        if (!msgRecord) {
            return utils.error(message, 'This doesn\'t appear to be a proxied message, or it\'s not in our records.');
        }

        // Get the sender's info
        const senderUser = await User.findOne({ discordID: msgRecord.discord_user_id });
        const system = senderUser?.systemID ? await System.findById(senderUser.systemID) : null;

        // Get the entity info
        let entity = null;
        let entityType = 'unknown';

        if (msgRecord.proxy_type === 'alter' && msgRecord.proxy_id) {
            entity = await Alter.findById(msgRecord.proxy_id);
            entityType = 'alter';
        } else if (msgRecord.proxy_type === 'state' && msgRecord.proxy_id) {
            entity = await State.findById(msgRecord.proxy_id);
            entityType = 'state';
        } else if (msgRecord.proxy_type === 'group' && msgRecord.proxy_id) {
            entity = await Group.findById(msgRecord.proxy_id);
            entityType = 'group';
        }

        // Build the response embed
        const embed = new EmbedBuilder()
            .setColor(entity?.color || system?.color || utils.ENTITY_COLORS.info)
            .setTitle('🔍 Message Lookup');

        // Sender info
        embed.addFields({
            name: '👤 Sent By',
            value: `<@${msgRecord.discord_user_id}>`,
            inline: true
        });

        // System info (if available and public)
        if (system) {
            const systemName = system.name?.display || system.name?.indexable || 'Unknown System';
            embed.addFields({
                name: '🎡 System',
                value: systemName,
                inline: true
            });
        }

        // Entity info
        if (entity) {
            const entityName = entity.name?.display || entity.name?.indexable || 'Unknown';
            const synonym = entityType === 'alter' && system?.alterSynonym?.singular 
                ? system.alterSynonym.singular 
                : entityType.charAt(0).toUpperCase() + entityType.slice(1);
            
            embed.addFields({
                name: `🎭 ${synonym}`,
                value: entityName,
                inline: true
            });

            // Add avatar if available
            if (entity.avatar?.url) {
                embed.setThumbnail(entity.avatar.url);
            }
        }

        // Message details
        embed.addFields({
            name: '📝 Message Details',
            value: [
                `**Channel:** <#${msgRecord.discord_channel_id}>`,
                `**Message ID:** \`${targetMessageId}\``,
                `**Sent:** <t:${Math.floor(new Date(msgRecord.createdAt).getTime() / 1000)}:R>`
            ].join('\n'),
            inline: false
        });

        // Proxy tag used (if recorded)
        if (msgRecord.proxy_matched) {
            embed.addFields({
                name: '💬 Proxy Tag',
                value: `\`${msgRecord.proxy_matched}\``,
                inline: true
            });
        }

        embed.setFooter({ text: 'Systemiser Proxy Lookup' });

        return message.reply({ embeds: [embed] });
    }
};

/**
 * Extract message ID from various formats
 */
function extractMessageId(input) {
    if (!input) return null;
    
    // Direct message ID (17-19 digit snowflake)
    if (/^\d{17,19}$/.test(input)) {
        return input;
    }
    
    // Message link: https://discord.com/channels/guild/channel/message
    const linkMatch = input.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
    if (linkMatch) {
        return linkMatch[1];
    }
    
    // Canary/PTB links
    const canaryMatch = input.match(/(?:canary\.|ptb\.)?discord\.com\/channels\/\d+\/\d+\/(\d+)/);
    if (canaryMatch) {
        return canaryMatch[1];
    }
    
    return null;
}