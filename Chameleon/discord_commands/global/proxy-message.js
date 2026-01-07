// Proxy Message Handler
// This file handles the detection and sending of proxy messages
// Place in: discord_commands/global/proxy-message.js (one folder above slash/)

const Message = require('../schemas/message');
const System = require('../schemas/system');
const User = require('../schemas/user');
const Alter = require('../schemas/alter');
const State = require('../schemas/state');
const Group = require('../schemas/group');
const Guild = require('../schemas/guild');

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Handle incoming messages and check for proxy triggers
 * @param {Message} message - Discord message object
 * @param {Client} client - Discord client
 */
async function handleProxyMessage(message, client) {
    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;

    // Ignore DMs
    if (!message.guild) return;

    try {
        // Get user and system
        const user = await User.findOne({ discordID: message.author.id });
        if (!user || !user.systemID) return;

        const system = await System.findById(user.systemID);
        if (!system) return;

        // Check if system is on proxy break
        if (system.proxy?.break) return;

        // Check for proxy match
        const proxyMatch = await findProxyMatch(message.content, system);

        if (!proxyMatch) {
            // No proxy found in message, check auto-proxy settings
            const autoProxy = await getAutoProxy(system, message.guild.id);
            if (!autoProxy) return;

            // Use auto-proxy
            await sendProxyMessage(message, autoProxy.entity, autoProxy.type, system, message.content);
        } else {
            // Proxy found in message
            await sendProxyMessage(message, proxyMatch.entity, proxyMatch.type, system, proxyMatch.content);
        }
    } catch (error) {
        console.error('Proxy message error:', error);

        // Try to notify user of error in ephemeral-like way
        try {
            const errorMsg = await message.channel.send({
                content: `❌ <@${message.author.id}> Proxy error: ${getErrorMessage(error)}`
            });
            // Delete error message after 10 seconds
            setTimeout(() => errorMsg.delete().catch(() => { }), 10000);
        } catch (e) {
            // Couldn't send error message
        }
    }
}

// ============================================
// PROXY MATCHING
// ============================================

/**
 * Find a proxy match in the message content
 * @param {string} content - Message content
 * @param {System} system - User's system
 * @returns {Object|null} - { entity, type, content } or null
 */
async function findProxyMatch(content, system) {
    // First check recent proxies (faster lookup)
    const recentMatch = await checkRecentProxies(content, system);
    if (recentMatch) return recentMatch;

    // Then search all alters
    const alterMatch = await searchEntityProxies(content, system.alters?.IDs || [], Alter, 'alter');
    if (alterMatch) return alterMatch;

    // Search all states
    const stateMatch = await searchEntityProxies(content, system.states?.IDs || [], State, 'state');
    if (stateMatch) return stateMatch;

    // Search all groups
    const groupMatch = await searchEntityProxies(content, system.groups?.IDs || [], Group, 'group');
    if (groupMatch) return groupMatch;

    return null;
}

/**
 * Check recent proxies for a match
 */
async function checkRecentProxies(content, system) {
    const recentProxies = system.proxy?.recentProxies || [];

    for (const proxyId of recentProxies) {
        // recentProxies format: "type:id:proxy" e.g., "alter:123456:a:"
        const [type, entityId, proxyPattern] = proxyId.split(':');

        if (!proxyPattern) continue;

        const match = matchProxyPattern(content, proxyPattern);
        if (match) {
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

            if (entity) {
                return { entity, type, content: match.content };
            }
        }
    }

    return null;
}

/**
 * Search entity proxies for a match
 */
async function searchEntityProxies(content, entityIds, Model, type) {
    if (!entityIds || entityIds.length === 0) return null;

    const entities = await Model.find({ _id: { $in: entityIds } });

    for (const entity of entities) {
        const proxies = entity.proxy || [];

        for (const proxy of proxies) {
            const match = matchProxyPattern(content, proxy);
            if (match) {
                return { entity, type, content: match.content, proxyMatched: proxy };
            }
        }
    }

    return null;
}

/**
 * Match a proxy pattern against content
 * Proxy patterns use "text" as placeholder for the message
 * e.g., "a:text" matches "a:hello world" -> "hello world"
 * e.g., "-name text" matches "-name hello world" -> "hello world"
 * e.g., "text -s" matches "hello world -s" -> "hello world"
 */
function matchProxyPattern(content, pattern) {
    if (!pattern || !content) return null;

    // Check if pattern contains "text" placeholder
    const textIndex = pattern.toLowerCase().indexOf('text');

    if (textIndex === -1) {
        // No placeholder, treat the whole pattern as a prefix
        if (content.toLowerCase().startsWith(pattern.toLowerCase())) {
            return { content: content.slice(pattern.length).trim() };
        }
        return null;
    }

    // Split pattern into prefix and suffix
    const prefix = pattern.slice(0, textIndex);
    const suffix = pattern.slice(textIndex + 4); // 4 = length of "text"

    // Check if content matches the pattern
    const contentLower = content.toLowerCase();
    const prefixLower = prefix.toLowerCase();
    const suffixLower = suffix.toLowerCase();

    if (prefix && !contentLower.startsWith(prefixLower)) {
        return null;
    }

    if (suffix && !contentLower.endsWith(suffixLower)) {
        return null;
    }

    // Extract the message content
    let messageContent = content;
    if (prefix) {
        messageContent = messageContent.slice(prefix.length);
    }
    if (suffix) {
        messageContent = messageContent.slice(0, -suffix.length);
    }

    messageContent = messageContent.trim();

    if (!messageContent) return null;

    return { content: messageContent };
}

// ============================================
// AUTO-PROXY
// ============================================

/**
 * Get auto-proxy entity based on system settings
 */
async function getAutoProxy(system, guildId) {
    const proxyStyle = system.proxy?.style || 'off';

    // Check server-specific proxy style
    const serverSettings = system.discord?.server?.find(s => s.id === guildId);
    const effectiveStyle = serverSettings?.proxyStyle || proxyStyle;

    if (effectiveStyle === 'off') {
        return null;
    }

    if (effectiveStyle === 'last') {
        // Use the most recent proxy
        const recentProxies = system.proxy?.recentProxies || [];
        if (recentProxies.length === 0) return null;

        const [type, entityId] = recentProxies[0].split(':');
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

        if (entity) {
            return { entity, type };
        }
    }

    if (effectiveStyle === 'front') {
        // Use the current fronter (first layer, single entity)
        const frontLayers = system.front?.layers || [];
        if (frontLayers.length === 0) return null;

        const topLayer = frontLayers[0];
        const fronters = topLayer?.fronters || [];

        // Only auto-proxy if there's exactly one fronter in the top layer
        if (fronters.length !== 1) {
            // Multiple fronters - fall back to 'last' behavior
            const recentProxies = system.proxy?.recentProxies || [];
            if (recentProxies.length === 0) return null;

            const [type, entityId] = recentProxies[0].split(':');
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

            if (entity) return { entity, type };
            return null;
        }

        const fronterId = fronters[0].alterID || fronters[0].stateID || fronters[0].groupID;
        const fronterType = fronters[0].alterID ? 'alter' : (fronters[0].stateID ? 'state' : 'group');

        let entity = null;
        switch (fronterType) {
            case 'alter':
                entity = await Alter.findById(fronterId);
                break;
            case 'state':
                entity = await State.findById(fronterId);
                break;
            case 'group':
                entity = await Group.findById(fronterId);
                break;
        }

        if (entity) {
            return { entity, type: fronterType };
        }
    }

    // Check if it's a specific entity name (specify mode)
    if (effectiveStyle && effectiveStyle !== 'off' && effectiveStyle !== 'last' && effectiveStyle !== 'front') {
        // It's an entity indexable name
        const { entity, type } = await findEntityByName(effectiveStyle, system);
        if (entity) {
            return { entity, type };
        }
    }

    return null;
}

/**
 * Find an entity by name across all entity types
 */
async function findEntityByName(name, system) {
    const searchName = name.toLowerCase();

    // Search alters
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

// ============================================
// SENDING PROXY MESSAGES
// ============================================

/**
 * Send a proxy message via webhook
 */
async function sendProxyMessage(originalMessage, entity, type, system, content) {
    const guild = originalMessage.guild;
    const channel = originalMessage.channel;

    // Get or create webhook for this channel
    const webhook = await getOrCreateWebhook(channel);

    // Check guild settings for closed characters
    const guildSettings = await Guild.findOne({ id: guild.id });
    const closedCharAllowed = guildSettings?.settings?.closedCharAllowed !== false;

    // Get display info
    const { avatarUrl, displayName } = getProxyDisplayInfo(entity, type, system, guild, closedCharAllowed);

    // Validate content length
    if (content.length > 2000) {
        throw new Error('Message content exceeds 2000 characters');
    }

    // Prepare webhook message options
    const webhookOptions = {
        username: displayName.substring(0, 80), // Discord limits webhook usernames to 80 chars
        avatarURL: avatarUrl || undefined,
        content: content,
        allowedMentions: { parse: ['users', 'roles'] }
    };

    // Handle attachments
    if (originalMessage.attachments.size > 0) {
        const totalSize = originalMessage.attachments.reduce((sum, att) => sum + att.size, 0);

        // Check file size limit (8MB for regular servers, 50MB for boosted)
        const maxSize = guild.premiumTier >= 2 ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
        if (totalSize > maxSize) {
            throw new Error('Attachments exceed the file size limit');
        }

        webhookOptions.files = originalMessage.attachments.map(att => ({
            attachment: att.url,
            name: att.name
        }));
    }

    // Handle replies
    if (originalMessage.reference) {
        // Note: Webhooks can't directly reply, but we can mention the user
        try {
            const referencedMessage = await channel.messages.fetch(originalMessage.reference.messageId);
            if (referencedMessage) {
                webhookOptions.content = `> ${referencedMessage.content.substring(0, 100)}${referencedMessage.content.length > 100 ? '...' : ''}\n<@${referencedMessage.author.id}>\n\n${content}`;
            }
        } catch (e) {
            // Couldn't fetch referenced message, continue without it
        }
    }

    // Send the webhook message
    const webhookMessage = await webhook.send(webhookOptions);

    // Delete the original message
    try {
        await originalMessage.delete();
    } catch (e) {
        console.error('Could not delete original message:', e);
    }

    // Log the message to database
    const messageRecord = new Message({
        discord_webhook_message_id: webhookMessage.id,
        discord_channel_id: channel.id,
        discord_guild_id: guild.id,
        original_message_id: originalMessage.id,
        discord_user_id: originalMessage.author.id,
        system_id: system._id.toString(),
        proxy_type: type,
        proxy_id: entity._id.toString(),
        proxy_matched: entity.proxy?.[0] || null,
        content: content,
        attachments: originalMessage.attachments.map(att => ({
            url: att.url,
            name: att.name,
            size: att.size
        }))
    });
    await messageRecord.save();

    // Update recent proxies
    await updateRecentProxies(system, entity, type);

    // Update entity message count
    await updateEntityMessageCount(entity, type);
}

/**
 * Get or create a webhook for the channel
 */
async function getOrCreateWebhook(channel) {
    try {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.name === 'Systemiser Proxy');

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'Systemiser Proxy',
                reason: 'Systemiser proxy messaging'
            });
        }

        return webhook;
    } catch (error) {
        if (error.code === 50013) {
            throw new Error('Missing permissions to manage webhooks');
        }
        throw error;
    }
}

/**
 * Get display info for the proxy
 */
function getProxyDisplayInfo(entity, type, system, guild, closedCharAllowed = true) {
    let avatarUrl = null;
    let displayName = 'Unknown';

    // Priority order for avatar:
    // 1. Server-specific avatar
    // 2. Mask avatar (if masking in this server)
    // 3. Proxy avatar
    // 4. Regular avatar
    // 5. System avatar
    // 6. No avatar

    // Check for server-specific settings
    const serverSettings = entity.discord?.server?.find(s => s.id === guild.id);
    if (serverSettings?.avatar?.url) {
        avatarUrl = serverSettings.avatar.url;
    }
    // Check if this is a mask server
    else if (shouldMask(entity, system, guild.id)) {
        avatarUrl = entity.mask?.avatar?.url ||
            entity.mask?.discord?.image?.avatar?.url ||
            entity.mask?.discord?.image?.proxyAvatar?.url;
    }
    // Use proxy avatar
    else if (entity.discord?.image?.proxyAvatar?.url) {
        avatarUrl = entity.discord.image.proxyAvatar.url;
    }
    // Use regular avatar
    else if (entity.avatar?.url) {
        avatarUrl = entity.avatar.url;
    }
    // Use system avatar
    else if (system.avatar?.url) {
        avatarUrl = system.avatar.url;
    }

    // Get the display name
    if (!closedCharAllowed && entity.name?.closedNameDisplay) {
        displayName = entity.name.closedNameDisplay;
    } else if (serverSettings?.name) {
        displayName = serverSettings.name;
    } else if (shouldMask(entity, system, guild.id)) {
        displayName = entity.mask?.name?.display ||
            entity.mask?.discord?.name?.display ||
            entity.name?.display ||
            entity.name?.indexable;
    } else {
        displayName = entity.name?.display || entity.name?.indexable || entity._id;
    }

    // Apply proxy layout if configured (entity-type-specific)
    const layout = getLayoutForEntityType(system, type);
    if (layout) {
        displayName = formatProxyLayout(layout, entity, type, system, closedCharAllowed);
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
 * Check if entity should be masked in this guild
 */
function shouldMask(entity, system, guildId) {
    // Check entity-level mask settings
    const entityMaskTo = entity.setting?.mask?.maskTo || [];
    const entityMaskExclude = entity.setting?.mask?.maskExclude || [];

    if (entityMaskTo.some(m => m.discordGuildID === guildId)) {
        return true;
    }

    if (entityMaskExclude.some(m => m.discordGuildID === guildId)) {
        return false;
    }

    // Check system-level mask settings
    const systemMaskTo = system.setting?.mask?.maskTo || [];

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
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 */
function formatProxyLayout(layout, entity, type, system, closedCharAllowed = true) {
    let result = layout;

    // Determine the name to use
    let name;
    if (!closedCharAllowed && entity.name?.closedNameDisplay) {
        name = entity.name.closedNameDisplay;
    } else {
        name = entity.name?.display || entity.name?.indexable || entity._id;
    }

    // Replace {name} with entity display name (case-insensitive)
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

/**
 * Update recent proxies in the system
 */
async function updateRecentProxies(system, entity, type) {
    const proxyId = `${type}:${entity._id}:${entity.proxy?.[0] || ''}`;

    let recentProxies = system.proxy?.recentProxies || [];

    // Remove if already exists
    recentProxies = recentProxies.filter(p => !p.startsWith(`${type}:${entity._id}`));

    // Add to front
    recentProxies.unshift(proxyId);

    // Keep only last 20
    recentProxies = recentProxies.slice(0, 20);

    await System.findByIdAndUpdate(system._id, {
        'proxy.recentProxies': recentProxies,
        'proxy.lastProxyTime': new Date()
    });
}

/**
 * Update entity message count
 */
async function updateEntityMessageCount(entity, type) {
    const Model = type === 'alter' ? Alter : (type === 'state' ? State : Group);

    await Model.findByIdAndUpdate(entity._id, {
        $inc: { 'discord.metadata.messageCount': 1 },
        'discord.metadata.lastMessageTime': new Date()
    });
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
    if (error.message.includes('2000 characters')) {
        return 'Message is too long (max 2000 characters)';
    }
    if (error.message.includes('file size')) {
        return 'Attachments are too large';
    }
    if (error.message.includes('webhooks')) {
        return 'Missing webhook permissions in this channel';
    }
    return 'An error occurred while proxying';
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    handleProxyMessage,
    findProxyMatch,
    matchProxyPattern,
    getProxyDisplayInfo,
    formatProxyLayout,
    getOrCreateWebhook
};