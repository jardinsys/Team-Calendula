// Systemiser Shared Utilities
// Merged utilities for both slash commands and prefix commands
// Used by: alter.js, state.js, group.js, system.js, switch.js, autoproxy.js, etc.

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const mongoose = require('mongoose');

// Import schemas
const System = require('../schemas/system');
const User = require('../schemas/user');
const Alter = require('../schemas/alter');
const State = require('../schemas/state');
const Group = require('../schemas/group');
const Guild = require('../schemas/guild');
const { PrivacyBucket } = require('../schemas/settings');

// ============================================
// CONSTANTS
// ============================================

const ITEMS_PER_PAGE = 10;
const INDEXABLE_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

// Entity colors for consistent styling
const ENTITY_COLORS = {
    alter: '#FFA500',
    state: '#9B59B6',
    group: '#3498DB',
    system: '#2ECC71',
    error: '#FF0000',
    success: '#00FF00',
    info: '#0099FF'
};

// DSM and ICD type definitions for system type validation
const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance', 'SDS'];

// Session storage for multi-step interactions
const activeSessions = new Map();

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Generate a unique session ID
 * @param {string} userId - Discord user ID
 * @returns {string} Unique session ID
 */
function generateSessionId(userId) {
    return `${userId}_${Date.now()}`;
}

/**
 * Get a session by ID
 * @param {string} sessionId 
 * @returns {Object|undefined}
 */
function getSession(sessionId) {
    return activeSessions.get(sessionId);
}

/**
 * Set/update a session
 * @param {string} sessionId 
 * @param {Object} data 
 */
function setSession(sessionId, data) {
    activeSessions.set(sessionId, data);
    // Auto-cleanup after 15 minutes
    setTimeout(() => activeSessions.delete(sessionId), 15 * 60 * 1000);
}

/**
 * Delete a session
 * @param {string} sessionId 
 */
function deleteSession(sessionId) {
    activeSessions.delete(sessionId);
}

/**
 * Extract session ID from a custom ID string
 * @param {string} customId - Button/modal custom ID
 * @returns {string} Session ID
 */
function extractSessionId(customId) {
    const parts = customId.split('_');
    return parts.slice(-2).join('_');
}

// ============================================
// PREFIX COMMAND ARGUMENT PARSING
// ============================================

/**
 * Parse prefix command arguments into structured data
 * Supports: key:value pairs, flags (-flag), quoted strings, and positional args
 * ALL KEYS AND FLAGS ARE CASE-INSENSITIVE
 * 
 * Examples:
 *   "luna name:Luna color:#FF0000" -> { _positional: ['luna'], name: 'Luna', color: '#FF0000' }
 *   "luna -private" -> { _positional: ['luna'], private: true }
 *   'luna description:"A friendly alter"' -> { _positional: ['luna'], description: 'A friendly alter' }
 * 
 * @param {string[]} args - Array of arguments from message.content.split(' ')
 * @returns {Object} Parsed arguments object
 */
function parseArgs(args) {
    const result = { _positional: [] };
    let i = 0;

    while (i < args.length) {
        const arg = args[i];

        // Handle flags: -private, -clear, -full (case-insensitive)
        if (arg.startsWith('-') && !arg.includes(':')) {
            const flagName = arg.slice(1).toLowerCase();
            result[flagName] = true;
            i++;
            continue;
        }

        // Handle key:value pairs (key is case-insensitive)
        if (arg.includes(':')) {
            const colonIndex = arg.indexOf(':');
            const key = arg.slice(0, colonIndex).toLowerCase();
            let value = arg.slice(colonIndex + 1);

            // Handle quoted values that might span multiple args
            if (value.startsWith('"') && !value.endsWith('"')) {
                const parts = [value.slice(1)];
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
                value = parts.join(' ');
            } else if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }

            result[key] = value;
            i++;
            continue;
        }

        // Handle quoted positional arguments
        if (arg.startsWith('"')) {
            const parts = [arg.slice(1)];
            if (!arg.endsWith('"') || arg.length === 1) {
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
            } else {
                parts[0] = arg.slice(1, -1);
            }
            result._positional.push(parts.join(' '));
            i++;
            continue;
        }

        // Regular positional argument (preserve original case for names)
        result._positional.push(arg);
        i++;
    }

    return result;
}

/**
 * Extract target system from args (handles @mention, user ID, or defaults to self)
 * @param {Message} message - Discord message object
 * @param {Object} parsedArgs - Parsed arguments
 * @returns {Promise<{user: User, system: System, targetUserId: string}|null>}
 */
async function resolveTargetSystem(message, parsedArgs) {
    let targetUserId = message.author.id;

    // Check for @mention
    const mention = message.mentions.users.first();
    if (mention) {
        targetUserId = mention.id;
    }
    // Check for explicit user ID in args
    else if (parsedArgs.user) {
        targetUserId = parsedArgs.user;
    }
    // Check first positional for user ID pattern
    else if (parsedArgs._positional[0]?.match(/^\d{17,19}$/)) {
        targetUserId = parsedArgs._positional[0];
        parsedArgs._positional.shift();
    }

    const user = await User.findOne({ discordID: targetUserId });
    if (!user) {
        return { user: null, system: null, targetUserId };
    }

    const system = await System.findById(user.systemID);
    return { user, system, targetUserId };
}

// ============================================
// USER AND SYSTEM MANAGEMENT
// ============================================

/**
 * Get or create user and system for an interaction or message
 * Works with both slash commands (interaction) and prefix commands (message)
 * @param {Interaction|Message} context - Discord interaction or message
 * @returns {Promise<{user: User, system: System, isNew: boolean}>}
 */
async function getOrCreateUserAndSystem(context) {
    // Handle both interaction and message contexts
    const discordId = context.user?.id || context.author?.id;

    let user = await User.findOne({ discordID: discordId });
    let system = null;
    let isNew = false;

    if (!user) {
        user = new User({
            _id: new mongoose.Types.ObjectId(),
            discordID: discordId,
            joinedAt: new Date()
        });
        await user.save();
        isNew = true;
    }

    if (user.systemID) {
        system = await System.findById(user.systemID);
    }

    return { user, system, isNew };
}

/**
 * Create a new user and system
 * @param {string} discordId - Discord user ID
 * @returns {Promise<{user: User, system: System}>}
 */
async function createNewUserAndSystem(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        joinedAt: new Date()
    });

    const system = new System({
        users: [user._id],
        metadata: { joinedAt: new Date() }
    });

    user.systemID = system._id;

    await user.save();
    await system.save();

    return { user, system };
}

/**
 * Handle new user flow for slash commands
 * @param {Interaction} interaction 
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 */
async function handleNewUserFlow(interaction, entityType) {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('👋 Welcome to Systemiser!')
        .setDescription(
            'It looks like you don\'t have a system set up yet.\n\n' +
            'Would you like to create one now?'
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`new_user_has_system_${entityType}`)
            .setLabel('Yes, create my system')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`new_user_no_system_${entityType}`)
            .setLabel('Not now')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

/**
 * Handle new user button interaction
 * @param {Interaction} interaction 
 */
async function handleNewUserButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('new_user_has_system_')) {
        const { user, system } = await createNewUserAndSystem(interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setTitle('✅ System Created!')
            .setDescription(
                'Your system has been created!\n\n' +
                'Use `/system edit` to customize your system, or `/alter new` to create your first alter.'
            );

        await interaction.update({ embeds: [embed], components: [] });
    } else if (customId.startsWith('new_user_no_system_')) {
        await interaction.update({
            content: 'No problem! Come back when you\'re ready to set up your system.',
            embeds: [],
            components: []
        });
    }
}

/**
 * Require that the user has a system, send error if not
 * Works with both interactions and messages
 * @param {Interaction|Message} context - Discord interaction or message
 * @param {System} system - System object
 * @returns {Promise<boolean>} True if system exists, false if error was sent
 */
async function requireSystem(context, system) {
    if (!system) {
        const errorMsg = 'You don\'t have a system set up yet. Use `sys!system new` or `/system` to create one.';

        // Check if it's an interaction or message
        if (context.reply && context.author) {
            // It's a message
            await error(context, errorMsg);
        } else if (context.reply) {
            // It's an interaction
            await context.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
        }
        return false;
    }
    return true;
}

// ============================================
// ENTITY SEARCH (CASE-INSENSITIVE)
// ============================================

/**
 * Escape special regex characters
 * @param {string} str 
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find an entity (alter/state/group) by name or ID (case-insensitive)
 * @param {string} identifier - Name, alias, or ID
 * @param {System} system - System to search in
 * @param {string} entityType - 'alter', 'state', 'group', or 'any'
 * @returns {Promise<{entity: Object, type: string}|null>}
 */
async function findEntity(identifier, system, entityType = 'any') {
    if (!identifier || !system) return null;

    const searchName = identifier.toLowerCase();

    const findInCollection = async (Model, ids) => {
        return await Model.findOne({
            _id: { $in: ids || [] },
            $or: [
                { _id: identifier },
                { 'name.indexable': { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } },
                { 'name.aliases': { $elemMatch: { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } } }
            ]
        });
    };

    if (entityType === 'alter' || entityType === 'any') {
        const alter = await findInCollection(Alter, system.alters?.IDs);
        if (alter) return { entity: alter, type: 'alter' };
    }

    if (entityType === 'state' || entityType === 'any') {
        const state = await findInCollection(State, system.states?.IDs);
        if (state) return { entity: state, type: 'state' };
    }

    if (entityType === 'group' || entityType === 'any') {
        const group = await findInCollection(Group, system.groups?.IDs);
        if (group) return { entity: group, type: 'group' };
    }

    return null;
}

/**
 * Find an alter by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
async function findAlterByName(name, system) {
    const result = await findEntity(name, system, 'alter');
    return result?.entity || null;
}

/**
 * Find a state by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<State|null>}
 */
async function findStateByName(name, system) {
    const result = await findEntity(name, system, 'state');
    return result?.entity || null;
}

/**
 * Find a group by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Group|null>}
 */
async function findGroupByName(name, system) {
    const result = await findEntity(name, system, 'group');
    return result?.entity || null;
}

/**
 * Find multiple entities by names/IDs
 * @param {string[]} identifiers - Array of names, aliases, or IDs
 * @param {System} system - System to search in
 * @returns {Promise<{found: Array<{entity: Object, type: string}>, notFound: string[]}>}
 */
async function findMultipleEntities(identifiers, system) {
    const found = [];
    const notFound = [];

    for (const identifier of identifiers) {
        const result = await findEntity(identifier, system);
        if (result) {
            found.push(result);
        } else {
            notFound.push(identifier);
        }
    }

    return { found, notFound };
}

// ============================================
// PRIVACY AND VISIBILITY
// ============================================

/**
 * Get the privacy bucket for a viewer
 * @param {System} system - The system being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID (optional)
 * @returns {PrivacyBucket|null}
 */
function getPrivacyBucket(system, viewerDiscordId, viewerFriendId) {
    if (!system?.privacyBuckets) return null;

    for (const bucket of system.privacyBuckets) {
        const inBucket = bucket.friends?.some(f =>
            f.discordUserID === viewerDiscordId || f.friendID === viewerFriendId
        );
        if (inBucket) return bucket;
    }

    return system.privacyBuckets.find(b => b.name === 'Default') || null;
}

/**
 * Check if an entity should be visible based on privacy settings
 * @param {Object} entity - The entity (alter/state/group) to check
 * @param {PrivacyBucket} privacyBucket - The viewer's privacy bucket
 * @param {boolean} isOwner - Whether the viewer is the owner
 * @param {boolean} showFullList - Whether to show hidden items (owner only)
 * @returns {boolean}
 */
function shouldShowEntity(entity, privacyBucket, isOwner, showFullList = false) {
    if (isOwner) return true;
    if (!privacyBucket) return false;

    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);
    if (entityPrivacy?.settings?.hidden === false) return false;

    return true;
}

/**
 * Check if user is blocked by another user
 * @param {User} targetUser - The user being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID
 * @returns {boolean}
 */
function isBlocked(targetUser, viewerDiscordId, viewerFriendId) {
    if (!targetUser?.blocked) return false;
    return targetUser.blocked.some(b =>
        b.discordID === viewerDiscordId || b.friendID === viewerFriendId
    );
}

// ============================================
// DISPLAY HELPERS
// ============================================

/**
 * Get the display name for an entity, respecting closedChar settings
 * @param {Object} entity - Entity with name property
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 * @returns {string}
 */
function getDisplayName(entity, closedCharAllowed = true) {
    if (!closedCharAllowed && entity.name?.closedNameDisplay) {
        return entity.name.closedNameDisplay;
    }
    return entity.name?.display || entity.name?.indexable || 'Unknown';
}

/**
 * Get a property from discord element or fall back to base property
 * @param {Object} entity - The entity
 * @param {string} property - Property name to get
 * @returns {*}
 */
function getDiscordOrDefault(entity, property) {
    const discordValue = entity.discord?.[property];
    if (discordValue !== undefined && discordValue !== null && discordValue !== '') {
        return discordValue;
    }
    return entity[property];
}

/**
 * Check if closedCharAllowed for a guild
 * @param {Guild} guild - Discord guild object
 * @returns {Promise<boolean>}
 */
async function checkClosedCharAllowed(guild) {
    if (!guild) return true;
    const guildSettings = await Guild.findOne({ id: guild.id });
    return guildSettings?.settings?.closedCharAllowed !== false;
}

/**
 * Validate an indexable name
 * @param {string} name 
 * @returns {boolean}
 */
function isValidIndexableName(name) {
    return INDEXABLE_NAME_REGEX.test(name);
}

// ============================================
// PREFIX COMMAND RESPONSE HELPERS
// ============================================

/**
 * Send a quick success message (for prefix commands)
 * @param {Message} message - Discord message to reply to
 * @param {string} text - Success message text
 */
async function success(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setDescription(`✅ ${text}`)]
    });
}

/**
 * Send a quick error message (for prefix commands)
 * @param {Message} message - Discord message to reply to
 * @param {string} text - Error message text
 */
async function error(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.error)
            .setDescription(`❌ ${text}`)]
    });
}

/**
 * Send an info message (for prefix commands)
 * @param {Message} message - Discord message to reply to
 * @param {string} text - Info message text
 */
async function info(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setDescription(`ℹ️ ${text}`)]
    });
}

/**
 * Build a help embed for a command
 * @param {string} commandName - Name of the command
 * @param {string} description - Command description
 * @param {Array<{usage: string, description: string}>} subcommands - List of subcommands
 * @returns {EmbedBuilder}
 */
function buildHelpEmbed(commandName, description, subcommands) {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle(`📖 ${commandName} Command Help`)
        .setDescription(description);

    let usageText = '';
    for (const sub of subcommands) {
        usageText += `\`${sub.usage}\`\n${sub.description}\n\n`;
    }

    embed.addFields({ name: 'Usage', value: usageText.trim() });

    return embed;
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Capitalize first letter of a string
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a field value, handling empty/null values
 * @param {*} value - Value to format
 * @param {string} defaultText - Default text if value is empty
 * @returns {string}
 */
function formatValue(value, defaultText = '*Not set*') {
    if (value === null || value === undefined || value === '') {
        return defaultText;
    }
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : defaultText;
    }
    return String(value);
}

/**
 * Format a date for display
 * @param {Date|string} date 
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '*Not set*';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format proxies for display (with code formatting)
 * @param {string[]} proxies 
 * @returns {string}
 */
function formatProxies(proxies) {
    if (!proxies || proxies.length === 0) return '*No proxies*';
    return proxies.map(p => `\`${p}\``).join(', ');
}

/**
 * Parse comma-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}

// Alias for parseCommaSeparated
const parseList = parseCommaSeparated;

/**
 * Parse newline-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseNewlineSeparated(str) {
    if (!str) return [];
    return str.split('\n').map(s => s.trim()).filter(Boolean);
}

// Alias for parseNewlineSeparated
const parseNewlineList = parseNewlineSeparated;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a string is a valid hex color
 * @param {string} str 
 * @returns {boolean}
 */
function isValidColor(str) {
    if (!str) return false;
    return /^#?[0-9A-Fa-f]{6}$/.test(str);
}

/**
 * Normalize a hex color (ensure # prefix, uppercase)
 * @param {string} color 
 * @returns {string|null}
 */
function normalizeColor(color) {
    if (!color) return null;
    color = color.replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
        return `#${color.toUpperCase()}`;
    }
    return null;
}

// ============================================
// LIST BUILDING HELPERS
// ============================================

/**
 * Build pagination buttons for lists
 * @param {number} totalItems - Total number of items
 * @param {number} currentPage - Current page (0-indexed)
 * @param {boolean} isOwner - Whether viewer is owner
 * @param {boolean} showFullList - Whether showing full list
 * @param {string} sessionId - Session ID
 * @param {string} prefix - Button ID prefix
 * @returns {ActionRowBuilder[]}
 */
function buildListButtons(totalItems, currentPage, isOwner, showFullList, sessionId, prefix) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    const rows = [];

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_list_prev_${sessionId}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${prefix}_list_next_${sessionId}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    rows.push(navRow);

    if (isOwner) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_list_toggle_${sessionId}`)
                    .setLabel(showFullList ? 'Hide Full List' : 'See Full List')
                    .setStyle(ButtonStyle.Primary)
            );
        rows.push(actionRow);
    }

    return rows;
}

/**
 * Get items for current page
 * @param {Array} items - All items
 * @param {number} page - Current page (0-indexed)
 * @returns {Array}
 */
function getPageItems(items, page) {
    const startIndex = page * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
}

/**
 * Calculate total pages
 * @param {number} totalItems 
 * @returns {number}
 */
function getTotalPages(totalItems) {
    return Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
}

// ============================================
// SYNC HELPERS
// ============================================

/**
 * Build the sync confirmation embed and buttons
 * @param {string} entityType - 'alter', 'state', 'group', or 'system'
 * @param {string} entityName - Name of the entity
 * @param {string} sessionId - Session ID
 * @param {string} action - 'new' or 'edit'
 * @returns {{embed: EmbedBuilder, buttons: ActionRowBuilder}}
 */
function buildSyncConfirmation(entityType, entityName, sessionId, action = 'edit') {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS[entityType] || '#FFA500')
        .setTitle(action === 'new'
            ? `✅ ${capitalize(entityType)} Created!`
            : `✅ ${capitalize(entityType)} Updated!`)
        .setDescription(
            `**${entityName}** has been ${action === 'new' ? 'created' : 'updated'}.\n\n` +
            'Would you like to sync Discord-specific settings?'
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${entityType}_sync_yes_${sessionId}`)
            .setLabel('Yes, sync now')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${entityType}_sync_no_${sessionId}`)
            .setLabel('Not now')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, buttons };
}

// ============================================
// EDIT HELPERS
// ============================================

/**
 * Get the correct target for editing based on current mode
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Session data containing mode
 * @returns {Object}
 */
function getEditTarget(entity, session) {
    if (session?.mode === 'mask') {
        return entity.mask || entity;
    }
    if (session?.mode === 'server' && session?.serverId) {
        const serverSettings = entity.discord?.server?.find(s => s.id === session.serverId);
        return serverSettings || entity.discord || entity;
    }
    return entity.discord || entity;
}

/**
 * Update an entity property based on current mode
 * @param {Object} entity - The entity to update
 * @param {Object} session - Session data
 * @param {string} property - Property path to update
 * @param {*} value - New value
 */
function updateEntityProperty(entity, session, property, value) {
    const target = session?.mode === 'mask' ? 'mask' : 'discord';

    if (!entity[target]) {
        entity[target] = {};
    }

    const parts = property.split('.');
    let current = entity[target];

    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
}

// ============================================
// CONDITION MANAGEMENT
// ============================================

/**
 * Ensure a condition exists in the system
 * @param {System} system - System to update
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @param {string} conditionName - Name of the condition
 */
async function ensureConditionExists(system, entityType, conditionName) {
    const conditionsPath = `${entityType}s.conditions`;
    const conditions = system[`${entityType}s`]?.conditions || [];

    const exists = conditions.some(c => c.name?.toLowerCase() === conditionName.toLowerCase());
    if (!exists) {
        if (!system[`${entityType}s`]) {
            system[`${entityType}s`] = { conditions: [], IDs: [] };
        }
        system[`${entityType}s`].conditions.push({
            name: conditionName,
            settings: {
                hide_to_self: false,
                include_in_Count: false
            }
        });
        await system.save();
    }
}

// ============================================
// PROXY VALIDATION
// ============================================

/**
 * Check if a proxy pattern already exists in the system
 * @param {string} proxy - The proxy pattern to check
 * @param {System} system - The system to check
 * @param {string} excludeEntityId - Entity ID to exclude from check
 * @returns {Promise<{exists: boolean, entity: Object|null, type: string|null}>}
 */
async function checkProxyExists(proxy, system, excludeEntityId = null) {
    const proxyLower = proxy.toLowerCase();

    // Check alters
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    for (const alter of alters) {
        if (alter._id.toString() === excludeEntityId) continue;
        if (alter.proxy?.some(p => p.toLowerCase() === proxyLower)) {
            return { exists: true, entity: alter, type: 'alter' };
        }
    }

    // Check states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    for (const state of states) {
        if (state._id.toString() === excludeEntityId) continue;
        if (state.proxy?.some(p => p.toLowerCase() === proxyLower)) {
            return { exists: true, entity: state, type: 'state' };
        }
    }

    // Check groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    for (const group of groups) {
        if (group._id.toString() === excludeEntityId) continue;
        if (group.proxy?.some(p => p.toLowerCase() === proxyLower)) {
            return { exists: true, entity: group, type: 'group' };
        }
    }

    return { exists: false, entity: null, type: null };
}

/**
 * Validate proxy patterns
 * @param {string[]} proxies - Array of proxy patterns
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateProxies(proxies) {
    const errors = [];

    for (const proxy of proxies) {
        if (!proxy.includes('text')) {
            errors.push(`Proxy "${proxy}" must contain "text" as a placeholder`);
        }
        if (proxy.length > 100) {
            errors.push(`Proxy "${proxy}" is too long (max 100 characters)`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Get proxy layout help text
 * @returns {string}
 */
function getProxyLayoutHelp() {
    return `**Available Placeholders:**
\`{name}\` - Display name
\`{sys-name}\` - System name
\`{tag1}\`, \`{tag2}\`... - System tags
\`{pronouns}\` - Pronouns
\`{caution}\` - Caution type

**Signoffs (per-entity):**
\`{a-sign1}\`, \`{a-sign2}\`... - Alter signoffs
\`{st-sign1}\`, \`{st-sign2}\`... - State signoffs
\`{g-sign1}\`, \`{g-sign2}\`... - Group signoffs

You can mix signoff types! E.g., \`{tag1}{a-sign1}{name}{g-sign1}\``;
}

/**
 * Get proxy style options for select menu
 * @returns {Array<{label: string, value: string, description: string}>}
 */
function getProxyStyleOptions() {
    return [
        { label: 'Off', value: 'off', description: 'Only proxy when a proxy pattern is matched' },
        { label: 'Last', value: 'last', description: 'Auto-proxy as the most recent proxy used' },
        { label: 'Front', value: 'front', description: 'Auto-proxy as the current fronter (if single)' },
        { label: 'Specify', value: 'specify', description: 'Always proxy as a specific alter/state/group' }
    ];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Constants
    ITEMS_PER_PAGE,
    INDEXABLE_NAME_REGEX,
    ENTITY_COLORS,
    DSM_TYPES,
    ICD_TYPES,

    // Session management
    generateSessionId,
    getSession,
    setSession,
    deleteSession,
    extractSessionId,
    activeSessions,

    // Prefix command parsing
    parseArgs,
    resolveTargetSystem,

    // User and system management
    getOrCreateUserAndSystem,
    createNewUserAndSystem,
    handleNewUserFlow,
    handleNewUserButton,
    requireSystem,

    // Entity search (case-insensitive)
    findEntity,
    findAlterByName,
    findStateByName,
    findGroupByName,
    findMultipleEntities,
    escapeRegex,

    // Privacy and visibility
    getPrivacyBucket,
    shouldShowEntity,
    isBlocked,

    // Display helpers
    getDisplayName,
    getDiscordOrDefault,
    checkClosedCharAllowed,
    isValidIndexableName,

    // Prefix command response helpers
    success,
    error,
    info,
    buildHelpEmbed,

    // Formatting utilities
    capitalize,
    formatValue,
    formatDate,
    formatProxies,
    parseCommaSeparated,
    parseList, // alias
    parseNewlineSeparated,
    parseNewlineList, // alias

    // Validation helpers
    isValidColor,
    normalizeColor,

    // List helpers
    buildListButtons,
    getPageItems,
    getTotalPages,

    // Sync helpers
    buildSyncConfirmation,

    // Edit helpers
    getEditTarget,
    updateEntityProperty,

    // Condition management
    ensureConditionExists,

    // Proxy validation
    checkProxyExists,
    validateProxies,
    getProxyLayoutHelp,
    getProxyStyleOptions
};