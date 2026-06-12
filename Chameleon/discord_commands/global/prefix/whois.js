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
const redis = require('../../../redis');
const proxyMessageHandler = require('../proxy-message');
const utils = require('../../functions/bot_utils');

const { getSystemTerm, getAlterTerm } = utils;

module.exports = {
    name: 'whois',
    aliases: ['who', 'lookup'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);

        // Determine target message ID
        let targetMessageId = null;

        // Check for reply
        if (message.reference) targetMessageId = message.reference.messageId;
        else if (parsed._positional[0]) targetMessageId = extractMessageId(parsed._positional[0]); // Check first arg for message ID or link

        if (!targetMessageId) return utils.error(message, 'Please provide a message ID, link, or reply to a proxied message.\n\nUsage: `sys!whois <message_id|link>` or reply to a message.');

        // Look up the message — Redis first, MongoDB fallback
        let msgRecord = null;
        const cached = await redis.get(`msg:${targetMessageId}`);
        if (cached) try { msgRecord = JSON.parse(cached); } catch { msgRecord = null; }
        if (!msgRecord) {
            msgRecord = await Message.findOne({
                discord_webhook_message_id: targetMessageId
            });
            if (msgRecord) {
                const cacheData = {
                    discord_webhook_message_id: msgRecord.discord_webhook_message_id,
                    discord_channel_id: msgRecord.discord_channel_id,
                    discord_user_id: msgRecord.discord_user_id,
                    proxy_type: msgRecord.proxy_type,
                    proxy_id: msgRecord.proxy_id?.toString(),
                    content: msgRecord.content,
                    attachments: msgRecord.attachments || [],
                    createdAt: msgRecord.createdAt,
                    editedAt: msgRecord.editedAt,
                    proxy_matched: msgRecord.proxy_matched
                };
                await redis.set(`msg:${targetMessageId}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
            }
        }

        if (!msgRecord) return utils.error(message, 'This doesn\'t appear to be a proxied message, or it\'s not in our records.');

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

        // Privacy checks
        if (senderUser && utils.isBlocked(senderUser, message.author.id, null)) {
            return utils.error(message, 'This user\'s information is not available to you.');
        }

        const isOwner = msgRecord.discord_user_id === message.author.id;
        const privacyBucket = utils.getPrivacyBucket(system, message.author.id, null);
        const isMasked = entity && system ? proxyMessageHandler.shouldMask(entity, system, message.guildId) : false;
        const closedCharAllowed = await utils.checkClosedCharAllowed(message.guild);
        const showEntity = entity ? utils.shouldShowEntity(entity, privacyBucket, isOwner) : true;

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

        // System info
        if (system) {
            if (showEntity || isOwner) {
                const systemName = utils.getDisplayName(system, closedCharAllowed);
                embed.addFields({
                    name: `🎡 ${getSystemTerm(system)}`,
                    value: systemName,
                    inline: true
                });
            }
        }

        // Entity info
        if (entity) {
            if (showEntity) {
                const entityName = utils.getDisplayName(entity, closedCharAllowed);
                const entityIndexable = entity.name?.indexable || '';
                const synonym = entityType === 'alter' && system
                    ? getAlterTerm(system).charAt(0).toUpperCase() + getAlterTerm(system).slice(1)
                    : entityType.charAt(0).toUpperCase() + entityType.slice(1);

                let entityValue = isMasked || !entityIndexable
                    ? `**${entityName}**`
                    : `**${entityName}**\n(${entityIndexable})`;

                embed.addFields({
                    name: `🎭 ${synonym}`,
                    value: entityValue,
                    inline: true
                });

                // Proxy tag only shown when entity is visible
                if (msgRecord.proxy_matched) {
                    embed.addFields({
                        name: '💬 Proxy Tag',
                        value: `\`${msgRecord.proxy_matched}\``,
                        inline: true
                    });
                }

                // Avatar resolution
                const session = { mode: null, syncWithDiscord: entity.syncWithApps?.discord, serverId: message.guildId };
                const avatarUrl = utils.resolveProxyAvatarUrl(entity, session);
                if (avatarUrl) embed.setThumbnail(avatarUrl);
            } else {
                // Stranger — show entity type only, no name
                const synonym = entityType === 'alter' && system
                    ? getAlterTerm(system).charAt(0).toUpperCase() + getAlterTerm(system).slice(1)
                    : entityType.charAt(0).toUpperCase() + entityType.slice(1);
                embed.addFields({
                    name: `🎭 ${synonym}`,
                    value: '*Hidden by privacy settings*',
                    inline: true
                });
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

        embed.setFooter({ text: `Proxy type: ${entityType}${isMasked ? ' • Masked: Yes' : ''}` });

        return message.reply({ embeds: [embed] });
    }
};

/**
 * Extract message ID from various formats
 */
function extractMessageId(input) {
    if (!input) return null;
    
    // Direct message ID (17-19 digit snowflake)
    if (/^\d{17,19}$/.test(input)) return input;
    
    // Message link: https://discord.com/channels/guild/channel/message
    const linkMatch = input.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
    if (linkMatch) return linkMatch[1];
    
    // Canary/PTB links
    const canaryMatch = input.match(/(?:canary\.|ptb\.)?discord\.com\/channels\/\d+\/\d+\/(\d+)/);
    if (canaryMatch) return canaryMatch[1];
    
    return null;
}