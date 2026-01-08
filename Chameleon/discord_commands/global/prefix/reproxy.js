// sys!reproxy - Change who "sent" a proxied message
const { EmbedBuilder } = require('discord.js');
const Message = require('../../../schemas/message');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'reproxy',
    aliases: ['rp'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        
        const { user, system } = await utils.getOrCreateUserAndSystem(message);
        if (!await utils.requireSystem(message, system)) return;

        // Parse arguments
        let targetMessageId = null;
        let newMemberName = null;

        // Check for reply
        if (message.reference) {
            targetMessageId = message.reference.messageId;
            newMemberName = parsed._positional[0];
        }
        // Check if first arg is a message ID
        else if (parsed._positional[0] && /^\d{17,19}$/.test(parsed._positional[0])) {
            targetMessageId = parsed._positional[0];
            newMemberName = parsed._positional[1];
        }
        // Check for message link
        else if (parsed._positional[0]?.includes('discord.com/channels/')) {
            const match = parsed._positional[0].match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
            if (match) {
                targetMessageId = match[1];
                newMemberName = parsed._positional[1];
            }
        }
        else {
            // No ID - find last message and use first arg as member name
            const lastMsg = await Message.findOne({
                discord_user_id: message.author.id,
                discord_channel_id: message.channel.id
            }).sort({ createdAt: -1 });

            if (!lastMsg) {
                return utils.error(message, 'No recent proxied message found. Provide a message ID or reply to a message.');
            }
            
            targetMessageId = lastMsg.discord_webhook_message_id;
            newMemberName = parsed._positional[0];
        }

        if (!newMemberName) {
            return utils.error(message, 'Please provide a member name: `sys!reproxy [message_id] <member_name>`');
        }

        // Find the message record
        const msgRecord = await Message.findOne({
            discord_webhook_message_id: targetMessageId
        });

        if (!msgRecord) {
            return utils.error(message, 'This doesn\'t appear to be a proxied message.');
        }

        // Verify ownership
        if (msgRecord.discord_user_id !== message.author.id) {
            return utils.error(message, 'You can only reproxy your own messages.');
        }

        // Check time limit (1 minute or last message)
        const isLastMessage = await Message.findOne({
            discord_user_id: message.author.id,
            discord_channel_id: message.channel.id
        }).sort({ createdAt: -1 });

        const isRecent = (Date.now() - new Date(msgRecord.createdAt).getTime()) < 60000;
        const isLast = isLastMessage?.discord_webhook_message_id === targetMessageId;

        if (!isRecent && !isLast) {
            return utils.error(message, 'You can only reproxy your last message or messages within 1 minute.');
        }

        // Find the new member
        const result = await utils.findEntity(newMemberName, system);
        if (!result) {
            return utils.error(message, `Member **${newMemberName}** not found.`);
        }

        const newEntity = result.entity;
        const newType = result.type;

        try {
            // Get the channel and webhook
            const channel = await message.client.channels.fetch(msgRecord.discord_channel_id);
            if (!channel) return utils.error(message, 'Could not find the message channel.');

            const webhooks = await channel.fetchWebhooks();
            const webhook = webhooks.find(wh => wh.name === 'Systemiser Proxy' || wh.owner?.id === message.client.user.id);

            if (!webhook) return utils.error(message, 'Could not find the proxy webhook.');

            // Build the new display name using proxy layout
            const proxyLayout = system.proxy?.layout?.[newType] || '{name}';
            let displayName = proxyLayout
                .replace(/{name}/gi, newEntity.name?.display || newEntity.name?.indexable || 'Unknown')
                .replace(/{sys-name}/gi, system.name?.display || system.name?.indexable || '')
                .replace(/{pronouns}/gi, (newEntity.pronouns || []).join('/'))
                .replace(/{caution}/gi, newEntity.caution?.c_type || '');
            
            // Handle tags
            const tags = system.discord?.tag?.normal || [];
            for (let i = 0; i < Math.max(tags.length, 10); i++) {
                displayName = displayName.replace(new RegExp(`{tag${i + 1}}`, 'gi'), tags[i] || '');
            }
            
            // Clean up extra spaces
            displayName = displayName.replace(/\s+/g, ' ').trim() || newEntity.name?.display || 'Unknown';

            // Get avatar
            const avatarUrl = newEntity.discord?.image?.proxyAvatar?.url || 
                             newEntity.discord?.image?.avatar?.url || 
                             newEntity.avatar?.url;

            // Edit the webhook message
            await webhook.editMessage(targetMessageId, {
                username: displayName.slice(0, 80), // Discord limit
                avatarURL: avatarUrl
            });

            // Update our record
            msgRecord.alterID = newType === 'alter' ? newEntity._id : undefined;
            msgRecord.stateID = newType === 'state' ? newEntity._id : undefined;
            msgRecord.groupID = newType === 'group' ? newEntity._id : undefined;
            await msgRecord.save();

            // Update recent proxies
            system.proxy = system.proxy || {};
            system.proxy.recentProxies = system.proxy.recentProxies || [];
            system.proxy.recentProxies.unshift(`${newType}:${newEntity._id}`);
            system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 10);
            await system.save();

            await message.react('✅').catch(() => {});
            setTimeout(() => message.delete().catch(() => {}), 1000);

        } catch (err) {
            console.error('Error reproxying message:', err);
            return utils.error(message, 'Failed to reproxy the message.');
        }
    }
};