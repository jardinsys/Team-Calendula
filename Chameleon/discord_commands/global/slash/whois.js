// (/whois) - Identify who sent a proxied message
// Can be used as a slash command with message ID or as a message context menu

const { 
    SlashCommandBuilder, 
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    EmbedBuilder
} = require('discord.js');

const Message = require('../../schemas/message');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

const utils = require('./systemiser-utils');

module.exports = {
    // Slash command data
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Identify who sent a proxied message')
        .addStringOption(opt => opt
            .setName('message_id')
            .setDescription('The message ID to look up (right-click message → Copy Message ID)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('message_link')
            .setDescription('The message link (right-click message → Copy Message Link)')
            .setRequired(false)),

    // Context menu command data (for right-click on message)
    contextMenuData: new ContextMenuCommandBuilder()
        .setName('Who sent this?')
        .setType(ApplicationCommandType.Message),

    // Main execute for slash command
    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const messageLink = interaction.options.getString('message_link');

        await interaction.deferReply({ ephemeral: true });

        let targetMessageId = messageId;
        let targetChannelId = interaction.channelId;

        // Parse message link if provided
        if (messageLink && !targetMessageId) {
            // Format: https://discord.com/channels/GUILD_ID/CHANNEL_ID/MESSAGE_ID
            const linkMatch = messageLink.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
            if (linkMatch) {
                targetChannelId = linkMatch[2];
                targetMessageId = linkMatch[3];
            }
        }

        // If no message ID provided, show help
        if (!targetMessageId) {
            return await interaction.editReply({
                content: '❓ **How to use /whois:**\n\n' +
                    '**Option 1:** Right-click on a proxied message → Apps → "Who sent this?"\n\n' +
                    '**Option 2:** `/whois message_id:123456789`\n' +
                    '(Right-click message → Copy Message ID)\n\n' +
                    '**Option 3:** `/whois message_link:https://discord.com/...`\n' +
                    '(Right-click message → Copy Message Link)'
            });
        }

        await handleWhoisLookup(interaction, targetMessageId, targetChannelId);
    },

    // Context menu execute (right-click on message)
    async executeContextMenu(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const targetMessage = interaction.targetMessage;
        await handleWhoisLookup(interaction, targetMessage.id, interaction.channelId, targetMessage);
    }
};

/**
 * Handle the whois lookup logic
 */
async function handleWhoisLookup(interaction, messageId, channelId, targetMessage = null) {
    // Look up the message in our database
    const messageRecord = await Message.findOne({
        discord_webhook_message_id: messageId,
        discord_channel_id: channelId
    });

    if (!messageRecord) {
        // Check if the message exists and is a webhook
        if (targetMessage && targetMessage.webhookId) {
            return await interaction.editReply({
                content: '❌ This webhook message was not sent through Systemiser.\n' +
                    'It may have been sent by another bot or a Discord integration.'
            });
        }
        
        return await interaction.editReply({
            content: '❌ This message was not found in Systemiser records.\n' +
                'It may not be a proxied message, or the record has been deleted.'
        });
    }

    // Get the user, system, and entity info
    const user = await User.findOne({ discordID: messageRecord.discord_user_id });
    const system = await System.findById(messageRecord.system_id);
    
    let entity = null;
    let entityName = 'Unknown';
    
    switch (messageRecord.proxy_type) {
        case 'alter':
            entity = await Alter.findById(messageRecord.proxy_id);
            break;
        case 'state':
            entity = await State.findById(messageRecord.proxy_id);
            break;
        case 'group':
            entity = await Group.findById(messageRecord.proxy_id);
            break;
    }

    if (entity) {
        entityName = utils.getDisplayName(entity);
    }

    const systemName = system ? utils.getDisplayName(system) : 'Unknown System';
    const userMention = `<@${messageRecord.discord_user_id}>`;

    // Build the embed
    const embed = new EmbedBuilder()
        .setColor(entity?.color || system?.color || '#FFA500')
        .setTitle('🔍 Message Identity')
        .addFields(
            { 
                name: `${utils.capitalize(messageRecord.proxy_type)} Name`, 
                value: entityName, 
                inline: true 
            },
            { 
                name: 'System', 
                value: systemName, 
                inline: true 
            },
            { 
                name: 'User', 
                value: userMention, 
                inline: true 
            }
        )
        .setTimestamp(messageRecord.created_at)
        .setFooter({ text: `Proxy type: ${messageRecord.proxy_type}` });

    // Add avatar if available
    const avatar = entity?.discord?.image?.proxyAvatar?.url || entity?.avatar?.url;
    if (avatar) {
        embed.setThumbnail(avatar);
    }

    // Reply with the user mention in code block outside the embed
    await interaction.editReply({
        content: `Sent by: \`<@${messageRecord.discord_user_id}>\``,
        embeds: [embed]
    });
}