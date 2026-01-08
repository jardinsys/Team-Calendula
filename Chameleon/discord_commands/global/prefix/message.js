// sys!message - Proxied message utilities
// Similar to pk;message - lookup, edit, delete proxied messages
const { EmbedBuilder } = require('discord.js');
const Message = require('../../schemas/message');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'message',
    aliases: ['msg'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (!firstArg || firstArg === 'help') return handleHelp(message);
        
        // Check if it's a message ID/link
        const messageId = extractMessageId(firstArg) || extractMessageId(parsed._positional[1]);
        
        // Check for reply reference
        const replyRef = message.reference;
        
        if (!messageId && !replyRef) {
            return utils.error(message, 'Please provide a message ID, link, or reply to a proxied message.');
        }

        const targetMessageId = messageId || replyRef?.messageId;
        
        // Route based on subcommand
        if (firstArg === 'delete' || firstArg === 'del') {
            return handleDelete(message, parsed, targetMessageId);
        }
        
        // Default: show message info
        return handleLookup(message, parsed, targetMessageId);
    }
};

function extractMessageId(input) {
    if (!input) return null;
    // Direct message ID
    if (/^\d{17,19}$/.test(input)) return input;
    // Message link: https://discord.com/channels/guild/channel/message
    const linkMatch = input.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
    if (linkMatch) return linkMatch[1];
    return null;
}

async function handleLookup(message, parsed, messageId) {
    // Try to find the message in our database
    const msgRecord = await Message.findOne({
        discord_webhook_message_id: messageId
    });

    if (!msgRecord) {
        return utils.error(message, 'This doesn\'t appear to be a proxied message, or it\'s not in our records.');
    }

    // Get the entity info
    let entity = null;
    let entityType = 'unknown';
    
    if (msgRecord.alterID) {
        entity = await Alter.findById(msgRecord.alterID);
        entityType = 'alter';
    } else if (msgRecord.stateID) {
        entity = await State.findById(msgRecord.stateID);
        entityType = 'state';
    } else if (msgRecord.groupID) {
        entity = await Group.findById(msgRecord.groupID);
        entityType = 'group';
    }

    // Get sender info
    const sender = await User.findOne({ discordID: msgRecord.discord_user_id });

    const embed = new EmbedBuilder()
        .setColor(entity?.color || utils.ENTITY_COLORS.info)
        .setTitle('📨 Message Info')
        .addFields(
            { name: 'Sent by', value: entity?.name?.display || entity?.name?.indexable || 'Unknown', inline: true },
            { name: 'Type', value: entityType, inline: true },
            { name: 'Sender Discord', value: sender ? `<@${sender.discordID}>` : 'Unknown', inline: true },
            { name: 'Message ID', value: `\`${messageId}\``, inline: true },
            { name: 'Channel', value: `<#${msgRecord.discord_channel_id}>`, inline: true }
        );

    if (entity?.avatar?.url) {
        embed.setThumbnail(entity.avatar.url);
    }

    return message.reply({ embeds: [embed] });
}

async function handleDelete(message, parsed, messageId) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!system) return utils.error(message, 'You need a system to delete messages.');

    // Find the message record
    const msgRecord = await Message.findOne({
        discord_webhook_message_id: messageId
    });

    if (!msgRecord) {
        return utils.error(message, 'This doesn\'t appear to be a proxied message, or it\'s not in our records.');
    }

    // Verify ownership
    if (msgRecord.discord_user_id !== message.author.id) {
        return utils.error(message, 'You can only delete your own proxied messages.');
    }

    try {
        // Try to fetch and delete the actual message
        const channel = await message.client.channels.fetch(msgRecord.discord_channel_id);
        if (channel) {
            const webhookMessage = await channel.messages.fetch(messageId).catch(() => null);
            if (webhookMessage) {
                await webhookMessage.delete();
            }
        }

        // Delete the record
        await Message.deleteOne({ _id: msgRecord._id });

        return utils.success(message, 'Message deleted.');
    } catch (err) {
        console.error('Error deleting message:', err);
        return utils.error(message, 'Failed to delete the message. It may have already been deleted.');
    }
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('message', 'Manage proxied messages.', [
        { usage: 'sys!message <ID|link|reply>', description: 'Look up info about a proxied message' },
        { usage: 'sys!message delete <ID|link|reply>', description: 'Delete a proxied message you sent' },
    ]);
    
    embed.addFields({
        name: 'Tip',
        value: 'You can also reply to a proxied message instead of providing an ID.',
        inline: false
    });

    return message.reply({ embeds: [embed] });
}