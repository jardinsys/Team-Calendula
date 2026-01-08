// sys!edit - Quick edit for proxied messages
// Shortcut for editing the last proxied message
const { EmbedBuilder } = require('discord.js');
const Message = require('../../../schemas/message');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'edit',
    aliases: ['e'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        
        const { user, system } = await utils.getOrCreateUserAndSystem(message);
        if (!system) return utils.error(message, 'You need a system to edit proxied messages.');

        // Check if first arg is a message ID/link or if we should edit the last message
        let targetMessageId = null;
        let newContent = '';
        
        const firstArg = parsed._positional[0];
        
        // Check for reply
        if (message.reference) {
            targetMessageId = message.reference.messageId;
            newContent = parsed._positional.join(' ');
        }
        // Check if first arg is a message ID/link
        else if (firstArg && /^\d{17,19}$/.test(firstArg)) {
            targetMessageId = firstArg;
            newContent = parsed._positional.slice(1).join(' ');
        }
        else if (firstArg && firstArg.includes('discord.com/channels/')) {
            const match = firstArg.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
            if (match) {
                targetMessageId = match[1];
                newContent = parsed._positional.slice(1).join(' ');
            }
        }
        else {
            // No ID provided - find the last proxied message in this channel
            const lastMsg = await Message.findOne({
                discord_user_id: message.author.id,
                discord_channel_id: message.channel.id
            }).sort({ createdAt: -1 });

            if (!lastMsg) {
                return utils.error(message, 'No recent proxied message found in this channel to edit.');
            }
            
            targetMessageId = lastMsg.discord_webhook_message_id;
            newContent = parsed._positional.join(' ');
        }

        if (!newContent) {
            return utils.error(message, 'Please provide new content: `sys!edit [message_id] <new content>`');
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
            return utils.error(message, 'You can only edit your own proxied messages.');
        }

        try {
            // Get the webhook
            const channel = await message.client.channels.fetch(msgRecord.discord_channel_id);
            if (!channel) {
                return utils.error(message, 'Could not find the message channel.');
            }

            // Find webhook for this channel
            const webhooks = await channel.fetchWebhooks();
            const webhook = webhooks.find(wh => wh.name === 'Systemiser Proxy' || wh.owner?.id === message.client.user.id);

            if (!webhook) {
                return utils.error(message, 'Could not find the proxy webhook for this channel.');
            }

            // Edit the message
            await webhook.editMessage(targetMessageId, {
                content: newContent
            });

            // Update our record
            msgRecord.content = newContent;
            msgRecord.editedAt = new Date();
            await msgRecord.save();

            // React to indicate success
            await message.react('✅').catch(() => {});
            
            // Delete the edit command message after a short delay
            setTimeout(() => {
                message.delete().catch(() => {});
            }, 1000);

        } catch (err) {
            console.error('Error editing message:', err);
            return utils.error(message, 'Failed to edit the message. It may be too old or already deleted.');
        }
    }
};