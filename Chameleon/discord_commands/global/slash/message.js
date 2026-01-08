// (/message) - Manage proxied messages
// (/message delete message_id:[string]) - Delete a proxied message you sent
// (/message edit message_id:[string]) - Edit a proxied message you sent
// (/message reproxy message_id:[string] entity_name:[string]) - Change who "sent" a message

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const Message = require('../../../schemas/message');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');

const utils = require('../../functions/bot_utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Manage your proxied messages')
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Delete a proxied message you sent')
            .addStringOption(opt => opt
                .setName('message_id')
                .setDescription('The message ID to delete')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit a proxied message you sent')
            .addStringOption(opt => opt
                .setName('message_id')
                .setDescription('The message ID to edit')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('reproxy')
            .setDescription('Change which alter/state/group "sent" a message')
            .addStringOption(opt => opt
                .setName('message_id')
                .setDescription('The message ID to reproxy')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('entity_name')
                .setDescription('The name of the alter/state/group to reproxy as')
                .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        const handlers = {
            delete: handleDelete,
            edit: handleEdit,
            reproxy: handleReproxy
        };

        await handlers[subcommand](interaction);
    },

    handleButtonInteraction,
    handleModalSubmit
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verify the user owns the message and get the record
 */
async function verifyMessageOwnership(interaction, messageId) {
    const messageRecord = await Message.findOne({
        discord_webhook_message_id: messageId,
        discord_channel_id: interaction.channelId
    });

    if (!messageRecord) {
        return {
            error: '❌ Message not found. Make sure you\'re using this command in the same channel as the message.'
        };
    }

    // Verify the user is the one who sent the message
    if (messageRecord.discord_user_id !== interaction.user.id) {
        return {
            error: '❌ You can only manage messages that you sent.'
        };
    }

    return { messageRecord };
}

/**
 * Find an entity (alter/state/group) by name
 */
async function findEntityByName(name, system) {
    const searchName = name.toLowerCase();

    // Search alters first
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = alters.find(a => a.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'alter' };

    // Search states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = states.find(s => s.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'state' };

    // Search groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = groups.find(g => g.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

/**
 * Get the webhook for the channel
 */
async function getOrCreateWebhook(channel) {
    // Check for existing Systemiser webhook
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.name === 'Systemiser Proxy');

    if (!webhook) {
        // Create a new webhook
        webhook = await channel.createWebhook({
            name: 'Systemiser Proxy',
            reason: 'Systemiser proxy messaging'
        });
    }

    return webhook;
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Handle /message delete
 */
async function handleDelete(interaction) {
    const messageId = interaction.options.getString('message_id');

    await interaction.deferReply({ ephemeral: true });

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) {
        return await interaction.editReply({ content: error });
    }

    try {
        // Get the webhook message and delete it
        const webhook = await getOrCreateWebhook(interaction.channel);
        await webhook.deleteMessage(messageId);

        // Delete the database record
        await Message.findByIdAndDelete(messageRecord._id);

        await interaction.editReply({
            content: '✅ Message deleted successfully.'
        });
    } catch (err) {
        console.error('Error deleting message:', err);

        if (err.code === 10008) {
            // Message not found - already deleted
            await Message.findByIdAndDelete(messageRecord._id);
            return await interaction.editReply({
                content: '⚠️ Message was already deleted. Database record cleaned up.'
            });
        }

        await interaction.editReply({
            content: '❌ Failed to delete message. It may have already been deleted or you may lack permissions.'
        });
    }
}

/**
 * Handle /message edit
 */
async function handleEdit(interaction) {
    const messageId = interaction.options.getString('message_id');

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) {
        return await interaction.reply({ content: error, ephemeral: true });
    }

    // Create session for the edit
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'message_edit',
        messageId: messageId,
        messageRecordId: messageRecord._id,
        channelId: interaction.channelId
    });

    // Show modal for new content
    const modal = new ModalBuilder()
        .setCustomId(`message_edit_modal_${sessionId}`)
        .setTitle('Edit Proxied Message');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('new_content')
                .setLabel('New Message Content')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(messageRecord.content || '')
                .setRequired(true)
                .setMaxLength(2000)
        )
    );

    await interaction.showModal(modal);
}

/**
 * Handle /message reproxy
 */
async function handleReproxy(interaction) {
    const messageId = interaction.options.getString('message_id');
    const entityName = interaction.options.getString('entity_name');

    await interaction.deferReply({ ephemeral: true });

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) {
        return await interaction.editReply({ content: error });
    }

    // Get user and system
    const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
    if (!system) {
        return await interaction.editReply({
            content: '❌ You need to set up a system first.'
        });
    }

    // Find the new entity
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) {
        return await interaction.editReply({
            content: `❌ Could not find an alter, state, or group named "${entityName}".\n` +
                'Make sure you\'re using the indexable name or an alias.'
        });
    }

    try {
        const webhook = await getOrCreateWebhook(interaction.channel);
        const guild = interaction.guild;

        // Get the appropriate avatar and name for the new entity
        const { avatarUrl, displayName } = await getProxyDisplayInfo(entity, type, system, guild);

        // Fetch the original message to get its content
        const originalMessage = await webhook.fetchMessage(messageId);

        // Edit the webhook message with new identity
        await webhook.editMessage(messageId, {
            username: displayName,
            avatarURL: avatarUrl,
            content: originalMessage.content,
            embeds: originalMessage.embeds,
            files: originalMessage.attachments.map(a => a.url)
        });

        // Update the database record
        messageRecord.proxy_type = type;
        messageRecord.proxy_id = entity._id.toString();
        await messageRecord.save();

        await interaction.editReply({
            content: `✅ Message reproxied to **${utils.getDisplayName(entity)}** (${type}).`
        });
    } catch (err) {
        console.error('Error reproxying message:', err);
        await interaction.editReply({
            content: '❌ Failed to reproxy message. ' + (err.message || 'Unknown error.')
        });
    }
}

/**
 * Get display info for proxying (avatar and name)
 */
async function getProxyDisplayInfo(entity, type, system, guild) {
    let avatarUrl = null;
    let displayName = 'Unknown';

    // Check for server-specific settings first
    const serverSettings = entity.discord?.server?.find(s => s.id === guild.id);
    if (serverSettings) {
        avatarUrl = serverSettings.avatar?.url;
        displayName = serverSettings.name || entity.name?.display || entity.name?.indexable;
    }
    // Check if this is a mask server
    else if (shouldMask(entity, system, guild.id)) {
        avatarUrl = entity.mask?.avatar?.url || entity.mask?.discord?.image?.avatar?.url;
        displayName = entity.mask?.name?.display || entity.mask?.discord?.name?.display || entity.name?.display || entity.name?.indexable;
    }
    // Use proxy avatar if available
    else if (entity.discord?.image?.proxyAvatar?.url) {
        avatarUrl = entity.discord.image.proxyAvatar.url;
        displayName = entity.name?.display || entity.name?.indexable;
    }
    // Use regular avatar
    else if (entity.avatar?.url) {
        avatarUrl = entity.avatar.url;
        displayName = entity.name?.display || entity.name?.indexable;
    }
    // Fall back to system avatar
    else if (system.avatar?.url) {
        avatarUrl = system.avatar.url;
        displayName = entity.name?.display || entity.name?.indexable;
    }
    else {
        displayName = entity.name?.display || entity.name?.indexable || entity._id;
    }

    // Apply proxy layout if configured (entity-type-specific)
    const layout = getLayoutForEntityType(system, type);
    if (layout) {
        displayName = formatProxyLayout(layout, entity, type, system);
    }

    return { avatarUrl, displayName };
}

/**
 * Get the appropriate layout for an entity type
 */
function getLayoutForEntityType(system, type) {
    // Check for entity-type-specific layout first
    if (typeof system.proxy?.layout === 'object') {
        return system.proxy.layout[type] || null;
    }
    // Fall back to single layout string (legacy support)
    return system.proxy?.layout || null;
}

/**
 * Check if entity should be masked for a guild
 */
function shouldMask(entity, system, guildId) {
    // Check entity-level mask settings
    const entityMaskTo = entity.setting?.mask?.maskTo || [];
    const entityMaskExclude = entity.setting?.mask?.maskExclude || [];

    // Check if guild is in maskTo list
    if (entityMaskTo.some(m => m.discordGuildID === guildId)) {
        return true;
    }

    // Check if guild is excluded
    if (entityMaskExclude.some(m => m.discordGuildID === guildId)) {
        return false;
    }

    // Check system-level mask settings
    const systemMaskTo = system.setting?.mask?.maskTo || [];
    const systemMaskExclude = system.setting?.mask?.maskExclude || [];

    if (systemMaskTo.some(m => m.discordGuildID === guildId)) {
        return true;
    }

    return false;
}

/**
 * Format the proxy layout string with entity data
 * @param {string} layout - The layout string
 * @param {Object} entity - The alter/state/group entity
 * @param {string} type - 'alter', 'state', or 'group'
 * @param {Object} system - The system
 */
function formatProxyLayout(layout, entity, type, system) {
    let result = layout;

    // Replace {name} with entity display name (case-insensitive)
    const name = entity.name?.display || entity.name?.closedNameDisplay || entity.name?.indexable || entity._id;
    result = result.replace(/{name}/gi, name);

    // Replace {sys-name} with system display name
    const systemName = system.name?.display || system.name?.indexable || '';
    result = result.replace(/{sys-name}/gi, systemName);

    // Replace {tag1}, {tag2}, etc. with SYSTEM tags (unlimited based on array length)
    const tags = system.discord?.tag?.normal || [];
    for (let i = 0; i < Math.max(tags.length, 20); i++) {
        result = result.replace(new RegExp(`{tag${i + 1}}`, 'gi'), tags[i] || '');
    }

    // Parse signoffs (stored as newline-separated string on the entity)
    const signoffs = entity.signoff ? entity.signoff.split('\n').map(s => s.trim()).filter(Boolean) : [];

    // Replace ALL signoff types - allows mixing in any layout
    // {a-sign1}, {a-sign2}... for alter signoffs
    // {st-sign1}, {st-sign2}... for state signoffs  
    // {g-sign1}, {g-sign2}... for group signoffs
    // The current entity's signoffs are used for its prefix type

    // Determine which prefix belongs to current entity
    const currentPrefix = type === 'alter' ? 'a-sign' : (type === 'state' ? 'st-sign' : 'g-sign');

    // Replace current entity's signoffs with its prefix
    for (let i = 0; i < Math.max(signoffs.length, 20); i++) {
        result = result.replace(new RegExp(`{${currentPrefix}${i + 1}}`, 'gi'), signoffs[i] || '');
    }

    // Clear any other entity type signoffs that weren't filled (they don't apply to this entity)
    const otherPrefixes = ['a-sign', 'st-sign', 'g-sign'].filter(p => p !== currentPrefix);
    for (const prefix of otherPrefixes) {
        for (let i = 0; i < 20; i++) {
            result = result.replace(new RegExp(`{${prefix}${i + 1}}`, 'gi'), '');
        }
    }

    // Replace {pronouns}
    const pronouns = entity.identity?.pronouns || [];
    const pronounSeparator = entity.discord?.pronounSeparator || '/';
    result = result.replace(/{pronouns}/gi, pronouns.join(pronounSeparator));

    // Replace {caution}
    result = result.replace(/{caution}/gi, entity.caution?.c_type || '');

    // Clean up any remaining empty placeholders and extra spaces
    result = result.replace(/{[\w-]+\d*}/g, '');
    result = result.replace(/\s+/g, ' ').trim();

    return result || name;
}

// ============================================
// BUTTON INTERACTION HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    // Currently no buttons for message commands
    // Add handlers here if needed
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please try again.',
            ephemeral: true
        });
    }

    // Handle edit modal
    if (interaction.customId.startsWith('message_edit_modal_')) {
        const newContent = interaction.fields.getTextInputValue('new_content');

        await interaction.deferReply({ ephemeral: true });

        try {
            const webhook = await getOrCreateWebhook(interaction.channel);

            // Edit the webhook message
            await webhook.editMessage(session.messageId, {
                content: newContent
            });

            // Update the database record
            await Message.findByIdAndUpdate(session.messageRecordId, {
                content: newContent
            });

            utils.deleteSession(sessionId);

            await interaction.editReply({
                content: '✅ Message edited successfully.'
            });
        } catch (err) {
            console.error('Error editing message:', err);

            if (err.code === 50035) {
                return await interaction.editReply({
                    content: '❌ Message content is invalid or too long.'
                });
            }

            await interaction.editReply({
                content: '❌ Failed to edit message. ' + (err.message || 'Unknown error.')
            });
        }
    }
}