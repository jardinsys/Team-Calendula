// (/message) - Manage proxied messages
// Unified action pattern: delete, edit, reproxy
// Auto-detects last proxied message when message_id is omitted

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
const Guild = require('../../../schemas/guild');
const redis = require('../../../redis');

const utils = require('../../functions/bot_utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Manage your proxied messages')
        .addStringOption(opt => opt
            .setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices(
                { name: 'Delete - Delete a proxied message', value: 'delete' },
                { name: 'Edit - Edit a proxied message', value: 'edit' },
                { name: 'Reproxy - Change which entity sent a message', value: 'reproxy' },
                { name: 'Ping - Ping the entity who sent a message', value: 'ping' }
            ))
        .addStringOption(opt => opt
            .setName('message_id')
            .setDescription('Message ID (leave blank to auto-detect your last message)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('entity_name')
            .setDescription('Entity name to reproxy as (required for reproxy action)')
            .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');

        switch (action) {
            case 'delete': return await handleDelete(interaction);
            case 'edit': return await handleEdit(interaction);
            case 'reproxy': return await handleReproxy(interaction);
            case 'ping': return await handlePing(interaction);
        }
    },

    //handleButtonInteraction,
    handleModalSubmit
};

// ==== HELPER FUNCTIONS ====

// Get message record from Redis cache first, fallback to MongoDB
async function getMessageRecord(messageId, channelId) {
    // Try Redis cache first
    const cached = await redis.get(`msg:${messageId}`);
    if (cached) {
        const data = JSON.parse(cached);
        if (data.discord_channel_id === channelId) {
            return { fromCache: true, data };
        }
    }

    // Fall back to MongoDB
    const record = await Message.findOne({
        discord_webhook_message_id: messageId,
        discord_channel_id: channelId
    });

    if (record) {
        // Populate cache for future lookups
        const cacheData = {
            _id: record._id.toString(),
            discord_webhook_message_id: record.discord_webhook_message_id,
            discord_channel_id: record.discord_channel_id,
            discord_guild_id: record.discord_guild_id,
            discord_user_id: record.discord_user_id,
            system_id: record.system_id,
            proxy_type: record.proxy_type,
            proxy_id: record.proxy_id,
            content: record.content,
            attachments: record.attachments || [],
            timestamp: Date.now()
        };
        await redis.set(`msg:${messageId}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
    }

    return { fromCache: false, data: record };
}

// Auto-detect the user's last proxied message in the current channel
// Redis tracking key first, MongoDB fallback
async function autoDetectLastMessage(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    // Try Redis tracking key first
    const lastMsgId = await redis.get(`user_msgs:${userId}:${channelId}`);
    if (lastMsgId) {
        const cached = await redis.get(`msg:${lastMsgId}`);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.discord_channel_id === channelId && data.discord_user_id === userId) {
                return { fromCache: true, data };
            }
        }

        // Redis tracking key exists but message cache miss — try MongoDB
        const record = await Message.findOne({
            discord_webhook_message_id: lastMsgId,
            discord_channel_id: channelId,
            discord_user_id: userId
        });

        if (record) {
            // Repopulate cache
            const cacheData = {
                _id: record._id.toString(),
                discord_webhook_message_id: record.discord_webhook_message_id,
                discord_channel_id: record.discord_channel_id,
                discord_guild_id: record.discord_guild_id,
                discord_user_id: record.discord_user_id,
                system_id: record.system_id,
                proxy_type: record.proxy_type,
                proxy_id: record.proxy_id,
                content: record.content,
                attachments: record.attachments || [],
                timestamp: Date.now()
            };
            await redis.set(`msg:${lastMsgId}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
            return { fromCache: false, data: record };
        }
    }

    // Redis tracking key miss — full MongoDB fallback
    const record = await Message.findOne({
        discord_user_id: userId,
        discord_channel_id: channelId
    }).sort({ timestamp: -1 });

    if (record) {
        // Populate both caches
        const cacheData = {
            _id: record._id.toString(),
            discord_webhook_message_id: record.discord_webhook_message_id,
            discord_channel_id: record.discord_channel_id,
            discord_guild_id: record.discord_guild_id,
            discord_user_id: record.discord_user_id,
            system_id: record.system_id,
            proxy_type: record.proxy_type,
            proxy_id: record.proxy_id,
            content: record.content,
            attachments: record.attachments || [],
            timestamp: Date.now()
        };
        await redis.set(`msg:${record.discord_webhook_message_id}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
        await redis.set(`user_msgs:${userId}:${channelId}`, record.discord_webhook_message_id);
        return { fromCache: false, data: record };
    }

    return { fromCache: false, data: null };
}

// Auto-detect the most recent proxied message in the current channel (any user)
async function autoDetectLastMessageAnyUser(interaction) {
    const channelId = interaction.channelId;

    // Try Redis: scan user_msgs keys for this channel — not feasible, so go straight to MongoDB
    // MongoDB fallback: most recent message in channel regardless of user
    const record = await Message.findOne({
        discord_channel_id: channelId
    }).sort({ timestamp: -1 });

    if (record) {
        const cacheData = {
            _id: record._id.toString(),
            discord_webhook_message_id: record.discord_webhook_message_id,
            discord_channel_id: record.discord_channel_id,
            discord_guild_id: record.discord_guild_id,
            discord_user_id: record.discord_user_id,
            system_id: record.system_id,
            proxy_type: record.proxy_type,
            proxy_id: record.proxy_id,
            content: record.content,
            attachments: record.attachments || [],
            timestamp: Date.now()
        };
        await redis.set(`msg:${record.discord_webhook_message_id}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
        return { fromCache: false, data: record };
    }

    return { fromCache: false, data: null };
}

// Verify message ownership and get the record
async function verifyMessageOwnership(interaction, messageId) {
    let result;

    if (messageId) {
        // Explicit message_id provided
        result = await getMessageRecord(messageId, interaction.channelId);
    } else {
        // Auto-detect last proxied message
        result = await autoDetectLastMessage(interaction);
    }

    const { data: messageRecord, fromCache } = result;

    if (!messageRecord) {
        return { error: messageId
            ? '❌ Message not found. Make sure you\'re using this command in the same channel as the message.'
            : '❌ No recent proxied messages found in this channel. Please provide a message_id.'
        };
    }

    if (messageRecord.discord_user_id !== interaction.user.id) {
        return { error: '❌ You can only manage messages that you sent.' };
    }

    return { messageRecord, fromCache };
}

// Find an entity (alter/state/group) by name
async function findEntityByName(name, system) {
    const searchName = name.toLowerCase();

    // Search alters first
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName);
    if (!entity) entity = alters.find(a => a.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    if (entity) return { entity, type: 'alter' };

    // Search states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName);
    if (!entity) entity = states.find(s => s.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    if (entity) return { entity, type: 'state' };

    // Search groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName);
    if (!entity) entity = groups.find(g => g.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

// Get the webhook for the channel
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

// ==== COMMAND HANDLERS ====

// Handle delete action
async function handleDelete(interaction) {
    const messageId = interaction.options.getString('message_id');

    await interaction.deferReply({ ephemeral: true });

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) return await interaction.editReply({ content: error });

    try {
        // Get the webhook message and delete it
        const webhook = await getOrCreateWebhook(interaction.channel);
        await webhook.deleteMessage(messageRecord.discord_webhook_message_id);

        // Delete from Redis cache
        await redis.del(`msg:${messageRecord.discord_webhook_message_id}`);

        // Delete from MongoDB if we have the _id
        if (messageRecord._id) {
            await Message.findByIdAndDelete(messageRecord._id);
        }

        // Send guild log (if configured)
        utils.sendGuildLog(interaction.guildId, 'delete', {
            entityType: messageRecord.proxy_type,
            entityName: messageRecord.proxy_type,
            content: messageRecord.content,
            channelId: messageRecord.discord_channel_id,
            messageLink: `https://discord.com/channels/${interaction.guildId}/${messageRecord.discord_channel_id}/${messageRecord.discord_webhook_message_id}`
        }, interaction.client);

        const autoText = messageId ? '' : ' (auto-detected last message)';
        return await interaction.editReply({ content: `✅ Message deleted${autoText}.` });

    } catch (err) {
        console.error('Error deleting message:', err);

        if (err.code === 10008) {
            // Message not found - already deleted
            await redis.del(`msg:${messageRecord.discord_webhook_message_id}`);
            if (messageRecord._id) await Message.findByIdAndDelete(messageRecord._id);
            return await interaction.editReply({ content: '⚠️ Message was already deleted.' });
        }

        return await interaction.editReply({ content: '❌ Failed to delete message. It may have already been deleted or you may lack permissions.' });
    }
}

// Handle edit action
async function handleEdit(interaction) {
    const messageId = interaction.options.getString('message_id');
    const entityName = interaction.options.getString('entity_name');

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) return await interaction.reply({ content: error, ephemeral: true });

    // Create session for the edit
    const session = {
        type: 'message_edit',
        messageId: messageRecord.discord_webhook_message_id,
        messageRecordId: messageRecord._id || null,
        channelId: interaction.channelId
    };

    // If entity_name provided, resolve it now for dual edit+reproxy
    if (entityName) {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!system) return await interaction.reply({ content: '❌ You need to set up a system first.', ephemeral: true });

        const { entity, type } = await findEntityByName(entityName, system);
        if (!entity) {
            return await interaction.reply({
                content: `❌ Could not find an alter, state, or group named "${entityName}".`,
                ephemeral: true
            });
        }

        session.entityTarget = { entity, type, systemId: system._id };
    }

    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, session);

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

// Handle reproxy action
async function handleReproxy(interaction) {
    const messageId = interaction.options.getString('message_id');
    const entityName = interaction.options.getString('entity_name');

    await interaction.deferReply({ ephemeral: true });

    const { messageRecord, error } = await verifyMessageOwnership(interaction, messageId);
    if (error) return await interaction.editReply({ content: error });

    if (!entityName) {
        return await interaction.editReply({ content: '❌ Please provide an entity_name when using the reproxy action.' });
    }

    // Get user and system
    const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
    if (!system) return await interaction.editReply({ content: '❌ You need to set up a system first.' });

    // Find the new entity
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity)
        return await interaction.editReply({
            content: `❌ Could not find an alter, state, or group named "${entityName}".\n` +
                'Make sure you\'re using the indexable name or an alias.'
        });

    try {
        const webhook = await getOrCreateWebhook(interaction.channel);
        const guild = interaction.guild;

        // Get the appropriate avatar and name for the new entity
        const { avatarUrl, displayName } = await getProxyDisplayInfo(entity, type, system, guild);

        // Fetch the original message to get its content
        const originalMessage = await webhook.fetchMessage(messageRecord.discord_webhook_message_id);

        // Edit the webhook message with new identity
        await webhook.editMessage(messageRecord.discord_webhook_message_id, {
            username: displayName,
            avatarURL: avatarUrl,
            content: originalMessage.content,
            embeds: originalMessage.embeds,
            files: originalMessage.attachments.map(a => a.url)
        });

        // Update Redis cache
        const cached = await redis.get(`msg:${messageRecord.discord_webhook_message_id}`);
        if (cached) {
            const data = JSON.parse(cached);
            data.proxy_type = type;
            data.proxy_id = entity._id.toString();
            await redis.set(`msg:${messageRecord.discord_webhook_message_id}`, JSON.stringify(data), 'EX', 7 * 24 * 60 * 60);
        }

        // Update MongoDB if we have the _id
        if (messageRecord._id) {
            await Message.findByIdAndUpdate(messageRecord._id, {
                proxy_type: type,
                proxy_id: entity._id.toString()
            });
        }

        // Send guild log (if configured)
        utils.sendGuildLog(interaction.guildId, 'reproxy', {
            oldEntityType: messageRecord.proxy_type,
            oldEntityName: messageRecord.proxy_type,
            newEntityType: type,
            newEntityName: utils.getDisplayName(entity),
            channelId: messageRecord.discord_channel_id,
            avatarUrl,
            messageLink: `https://discord.com/channels/${interaction.guildId}/${messageRecord.discord_channel_id}/${messageRecord.discord_webhook_message_id}`
        }, interaction.client);

        const autoText = messageId ? '' : ' (auto-detected last message)';
        return await interaction.editReply({ content: `✅ Message reproxied to **${utils.getDisplayName(entity)}** (${type})${autoText}.` });
    } catch (err) {
        console.error('Error reproxying message:', err);
        return await interaction.editReply({ content: '❌ Failed to reproxy message. ' + (err.message || 'Unknown error.') });
    }
}

// Handle ping action
async function handlePing(interaction) {
    const messageId = interaction.options.getString('message_id');

    await interaction.deferReply({ ephemeral: true });

    let result;
    if (messageId) {
        result = await getMessageRecord(messageId, interaction.channelId);
    } else {
        result = await autoDetectLastMessageAnyUser(interaction);
    }

    const { data: messageRecord } = result;

    if (!messageRecord) {
        return await interaction.editReply({ content: messageId
            ? '❌ Message not found. Make sure you\'re using this command in the same channel as the message.'
            : '❌ No recent proxied messages found in this channel.'
        });
    }

    if (!messageRecord.discord_user_id) {
        return await interaction.editReply({ content: '❌ Could not determine who sent that message.' });
    }

    // Fetch entity for display name and ping check
    let entityDisplayName = messageRecord.proxy_type || 'Unknown';
    let entity = null;
    if (messageRecord.proxy_id) {
        if (messageRecord.proxy_type === 'alter') entity = await Alter.findById(messageRecord.proxy_id);
        else if (messageRecord.proxy_type === 'state') entity = await State.findById(messageRecord.proxy_id);
        else if (messageRecord.proxy_type === 'group') entity = await Group.findById(messageRecord.proxy_id);

        if (entity) entityDisplayName = utils.getDisplayName(entity);
    }

    // Check if ping is allowed
    if (entity && !await utils.isPingAllowed(entity, messageRecord.discord_user_id, interaction.user.id)) {
        return await interaction.editReply({ content: '❌ That user or entity has disabled pings.' });
    }

    const pingedUserId = messageRecord.discord_user_id;
    const senderId = interaction.user.id;

    return await interaction.editReply({
        content: `-# Hey ${entityDisplayName} (<@${pingedUserId}>), <@${senderId}> is mentioning you!`
    });
}

// Get display info for proxying (avatar and name)
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
    else displayName = entity.name?.display || entity.name?.indexable || entity._id;

    // Apply proxy layout if configured (entity-type-specific)
    const layout = getLayoutForEntityType(system, type);
    if (layout) displayName = formatProxyLayout(layout, entity, type, system);

    return { avatarUrl, displayName };
}

// Get the appropriate layout for an entity type
function getLayoutForEntityType(system, type) {
    // Check for entity-type-specific layout first
    if (typeof system.proxy?.layout === 'object') {
        return system.proxy.layout[type] || null;
    }
    // Fall back to single layout string (legacy support)
    return system.proxy?.layout || null;
}

// Check if entity should be masked for a guild
function shouldMask(entity, system, guildId) {
    // Check entity-level mask settings
    const entityMaskTo = entity.setting?.mask?.maskTo || [];
    const entityMaskExclude = entity.setting?.mask?.maskExclude || [];

    if (entityMaskTo.some(m => m.discordGuildID === guildId)) return true;
    if (entityMaskExclude.some(m => m.discordGuildID === guildId)) return false;

    // Check system-level mask settings
    const systemMaskTo = system.setting?.mask?.maskTo || [];
    const systemMaskExclude = system.setting?.mask?.maskExclude || [];
    if (systemMaskTo.some(m => m.discordGuildID === guildId)) return true;

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
    for (let i = 0; i < Math.max(tags.length, 20); i++)
        result = result.replace(new RegExp(`{tag${i + 1}}`, 'gi'), tags[i] || '');

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
    for (let i = 0; i < Math.max(signoffs.length, 20); i++)
        result = result.replace(new RegExp(`{${currentPrefix}${i + 1}}`, 'gi'), signoffs[i] || '');

    // Clear any other entity type signoffs that weren't filled (they don't apply to this entity)
    const otherPrefixes = ['a-sign', 'st-sign', 'g-sign'].filter(p => p !== currentPrefix);
    for (const prefix of otherPrefixes)
        for (let i = 0; i < 20; i++)
            result = result.replace(new RegExp(`{${prefix}${i + 1}}`, 'gi'), '');

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

// ==== MODAL SUBMIT HANDLER ====

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });

    // Handle edit modal
    if (interaction.customId.startsWith('message_edit_modal_')) {
        const newContent = interaction.fields.getTextInputValue('new_content');

        await interaction.deferReply({ ephemeral: true });

        try {
            const webhook = await getOrCreateWebhook(interaction.channel);

            // Edit the webhook message content
            const editPayload = { content: newContent };

            // If reproxy target is included, also update identity
            if (session.entityTarget) {
                const { entity, type, systemId } = session.entityTarget;
                const system = await System.findById(systemId);
                if (system) {
                    const guild = interaction.guild;
                    const { avatarUrl, displayName } = await getProxyDisplayInfo(entity, type, system, guild);
                    editPayload.username = displayName;
                    editPayload.avatarURL = avatarUrl;
                }
            }

            await webhook.editMessage(session.messageId, editPayload);

            // Update Redis cache
            const cached = await redis.get(`msg:${session.messageId}`);
            let oldContent = null;
            if (cached) {
                const data = JSON.parse(cached);
                oldContent = data.content;
                data.content = newContent;
                if (session.entityTarget) {
                    data.proxy_type = session.entityTarget.type;
                    data.proxy_id = session.entityTarget.entity._id.toString();
                }
                await redis.set(`msg:${session.messageId}`, JSON.stringify(data), 'EX', 7 * 24 * 60 * 60);
            }

            // Update MongoDB if we have the _id
            if (session.messageRecordId) {
                const updateFields = { content: newContent };
                if (session.entityTarget) {
                    updateFields.proxy_type = session.entityTarget.type;
                    updateFields.proxy_id = session.entityTarget.entity._id.toString();
                }
                await Message.findByIdAndUpdate(session.messageRecordId, updateFields);
            }

            // Send guild log (if configured)
            const logEntityName = session.entityTarget
                ? utils.getDisplayName(session.entityTarget.entity)
                : 'Unknown';
            const logEntityType = session.entityTarget?.type || 'alter';
            utils.sendGuildLog(interaction.guildId, 'edit', {
                entityType: logEntityType,
                entityName: logEntityName,
                oldContent,
                newContent,
                channelId: session.channelId,
                avatarUrl: editPayload.avatarURL || null,
                messageLink: `https://discord.com/channels/${interaction.guildId}/${session.channelId}/${session.messageId}`
            }, interaction.client);

            const entityName = session.entityTarget ? utils.getDisplayName(session.entityTarget.entity) : null;
            const response = entityName
                ? `✅ Message edited and reproxied to **${entityName}**.`
                : '✅ Message edited successfully.';

            utils.deleteSession(sessionId);

            await interaction.editReply({ content: response });
        } catch (err) {
            console.error('Error editing message:', err);
            if (err.code === 50035) return await interaction.editReply({ content: '❌ Message content is invalid or too long.' });
            await interaction.editReply({ content: '❌ Failed to edit message. ' + (err.message || 'Unknown error.') });
        }
    }
}
