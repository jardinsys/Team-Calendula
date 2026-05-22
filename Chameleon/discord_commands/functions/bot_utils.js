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
const https = require('https');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Import schemas
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Guild = require('../../schemas/guild');
const { PrivacyBucket } = require('../../schemas/settings');

// Import config for R2
const config = require('../../../../config.json');

// Initialize R2 Client for Systemiser media
const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.endpoint,
    credentials: {
        accessKeyId: config.r2.system.accessKeyId,
        secretAccessKey: config.r2.system.secretAccessKey,
    },
});

// ==== CONSTANTS ===== 

const ITEMS_PER_PAGE = 10;
const INDEXABLE_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

// Entity colors for consistent styling
const ENTITY_COLORS = {
    alter: '#fb4fd9',
    state: '#00e1da',
    group: '#ffdb28',
    system: '#007bd8',
    profile: '#f28200',
    error: '#e9162d',
    success: '#1fb819',
    info: '#8f2be7'
};

// DSM and ICD type definitions for system type validation
const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance', 'SDS'];

// Session storage (for multi-step interactions)
const activeSessions = new Map();

// ==== SESSION MANAGEMENT ====

// Generate Session ID
function generateSessionId(userId) { return `${userId}_${Date.now()}`; }

// Get a session by ID
function getSession(sessionId) { return activeSessions.get(sessionId); }

// Set/update a session
function setSession(sessionId, data) {
    activeSessions.set(sessionId, data);
    // Auto-cleanup after 15 minutes
    setTimeout(() => activeSessions.delete(sessionId), 15 * 60 * 1000);
}

// Delete a session
function deleteSession(sessionId) { activeSessions.delete(sessionId); }

// Extract session ID from a custom ID string
function extractSessionId(customId) {
    const parts = customId.split('_');
    return parts.slice(-2).join('_');
}

// ==== PREFIX COMMAND ARGUMENT PARSING ====

/* Parse prefix command arguments into structured data
 * Supports: key:value pairs, flags (-flag), quoted strings, and positional args
 * ALL KEYS AND FLAGS ARE CASE-INSENSITIVE
 * 
 * Examples:
 *   "bird name:bird color:#FF0000" -> { _positional: ['bird'], name: 'bird', color: '#FF0000' }
 *   "bird -private" -> { _positional: ['bird'], private: true }
 *   'bird description:"Our little blue bird"' -> { _positional: ['bird'], description: 'Our little blue bird' }
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

/* Extract target system from args (handles @mention, user ID, or defaults to self)
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

// ==== USER AND SYSTEM MANAGEMENT ====

/* Get or create user and system for an interaction or message
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
        ({ user, system } = await createNewUserAndSystem(discordId));
        isNew = true;
    }

    if (user.systemID && !isNew) system = await System.findById(user.systemID);

    return { user, system, isNew };
}

async function getUser(context) {
    const discordId = context.user?.id || context.author?.id;
    let user = await User.findOne({ discordID: discordId });
    return user;
}

async function getSystem(context) {
    // Handle both interaction and message contexts
    const discordId = context.user?.id || context.author?.id;

    let user = await User.findOne({ discordID: discordId });
    let system = null;

    if (!user) return null;

    if (user.systemID) system = await System.findById(user.systemID);
    
    return { user, system, isNew };
}

// Get or create user for an interaction or message
async function getOrCreateUser(context) {
    // Handle both interaction and message contexts
    const discordId = context.user?.id || context.author?.id;
    let user = await User.findOne({ discordID: discordId });
    let isNew = false;

    if (!user) {
        user = await createUser(discordId);
        isNew = true;
    }

    return { user, isNew };
}

// Create a new user and system
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

async function createSystem(discordId) {
    let user = await User.findOne({ discordID: discordId });

    const system = new System({
        users: [user._id],
        metadata: { joinedAt: new Date() }
    });

    user.systemID = system._id;

    await user.save();
    await system.save();

    return { user, system };
}

// Create a new user
async function createUser(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        joinedAt: new Date()
    });

    await user.save();
    return user;
}

/* Handle new user flow for slash commands
 * @param {Interaction} interaction 
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 */
async function handleNewUserFlow(interaction, entityType) { //Change this later to have "System"
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('Hihi! Welcome to Systemiser! 👋')
        .setDescription(
            'It looks like you don\'t have a system set up. 😅\n\n' +
            'If you need to, would you like to register yours now?'
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`new_user_has_system_${entityType}`)
            .setLabel('Yes, register my system!')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`new_user_no_system_${entityType}`)
            .setLabel('No, thank you.')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Handle new user button interaction
async function handleNewUserButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('new_user_has_system_')) {
        const { user, system } = await createNewUserAndSystem(interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setTitle('✅ System Created!')
            .setDescription(
                'Your system has been registered! 👍\n\n' +
                'Use `/system edit` to customize your system\'s profile, or `/alter new` to register an first alter.\n'+
                'If you need any help, feel free to use `/help`'
            );
        await interaction.update({ embeds: [embed], components: [] });

    } else if (customId.startsWith('new_user_no_system_')) {
        await interaction.update({
            content: 'No problem! Come back when you\'re ready. 💙',
            embeds: [],
            components: []
        });
    }
}

/* Require that the user has a system, send error if not
 * Works with both interactions and messages
 * @param {Interaction|Message} context - Discord interaction or message
 * @param {System} system - System object
 * @returns {Promise<boolean>} True if system exists, false if error was sent
 */
async function requireSystem(context, system) {
    if (!system) {
        const errorMsg = 'You don\'t have a system set up yet. Use `sys!system new` or `/system` to create one.';

        // Check if it's an interaction or message
        if (context.reply && context.author) { // It's a message
            await error(context, errorMsg);
        } else if (context.reply) { // It's an interaction
            await context.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
        }
        return false;
    }
    return true;
}

// ==== ENTITY SEARCH (CASE-INSENSITIVE) ====

// Escape special regex characters
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Find an entity (alter/state/group) by name or ID (case-insensitive)
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

/* Find an alter by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
async function findAlterByName(name, system) {
    const result = await findEntity(name, system, 'alter');
    return result?.entity || null;
}

/* Find a state by name (case-insensitive) - backward compatibility
 * @returns {Promise<State|null>}
 */
async function findStateByName(name, system) {
    const result = await findEntity(name, system, 'state');
    return result?.entity || null;
}

/* Find a group by name (case-insensitive) - backward compatibility
 * @returns {Promise<Group|null>}
 */
async function findGroupByName(name, system) {
    const result = await findEntity(name, system, 'group');
    return result?.entity || null;
}

/* Find as many entities as possible by names/IDs
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

// ==== PRIVACY AND VISIBILITY ====

/* Get the privacy bucket for a viewer
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

/* Check if an entity should be visible based on privacy settings
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

/* Check if user is blocked by another user
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

// ==== DISPLAY HELPERS ====

/* Get the display name for an entity, respecting closedChar settings
 * @param {Object} entity - Entity with name property
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 * @returns {string}
 */
function getDisplayName(entity, closedCharAllowed = true) {
    if (!closedCharAllowed && entity.name?.closedNameDisplay) return entity.name.closedNameDisplay;
    return entity.name?.display || entity.name?.indexable || '';
}

/* Get a property from discord element or fall back to base property
 * @param {Object} entity - The entity
 * @param {string} property - Property name to get
 * @returns {*}
 */
function getDiscordOrDefault(entity, property) {
    const discordValue = entity.discord?.[property];
    if (discordValue !== undefined && discordValue !== null && discordValue !== '') return discordValue;
    return entity[property];
}

// Check if closedCharAllowed for a guild
async function checkClosedCharAllowed(guild) {
    if (!guild) return true;
    const guildSettings = await Guild.findOne({ id: guild.id });
    return guildSettings?.settings?.closedCharAllowed !== false;
}

// Validate an indexable name
function isValidIndexableName(name) { return INDEXABLE_NAME_REGEX.test(name); }

// ============================================
// PREFIX COMMAND RESPONSE HELPERS
//  * @param {Message} message - Discord message to reply to
//  * @param {string} text - message text
// ============================================

// Success Message
async function success(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setDescription(`✅ ${text}`)]
    });
}

// Error Message
async function error(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.error)
            .setDescription(`❌ ${text}`)]
    });
}

// Info
async function info(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setDescription(`ℹ️ ${text}`)]
    });
}

/* Build a help embed for a command
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

// ==== FORMATTING UTILITIES ====

// Capitalize
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* Format a field value, handling empty/null values
 * @param {*} value - Value to format
 * @param {string} defaultText - Default text if value is empty
 * @returns {string}
 */
function formatValue(value, defaultText = '*Not set*') {
    if (value === null || value === undefined || value === '') { return defaultText; }
    if (Array.isArray(value)) { return value.length > 0 ? value.join(', ') : defaultText; }
    return String(value);
}

/* Format a date for display
 * @param {Date|string} date 
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '*Not set*';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Format proxies for display (with code formatting)
 * @param {string[]} proxies 
 * @returns {string}
 */
function formatProxies(proxies) {
    if (!proxies || proxies.length === 0) return '*No proxies*';
    return proxies.map(p => `\`${p}\``).join(', ');
}

/* Parse comma-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}

// Alias for parseCommaSeparated
const parseList = parseCommaSeparated;

/* Parse newline-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseNewlineSeparated(str) {
    if (!str) return [];
    return str.split('\n').map(s => s.trim()).filter(Boolean);
}

// Alias for parseNewlineSeparated
const parseNewlineList = parseNewlineSeparated;

// ==== VALIDATION HELPERS (colors for now) ====

// Check if a string is a valid hex color
function isValidColor(str) {
    if (!str) return false;
    return /^#?[0-9A-Fa-f]{6}$/.test(str);
}

// Normalize a hex color (ensure # prefix, uppercase)
function normalizeColor(color) {
    if (!color) return null;
    color = color.replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
        return `#${color.toLowerCase()}`;
    }
    return null;
}

// ==== LIST BUILDING HELPERS ====

/* Build pagination buttons for lists
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

/* Get items for current page
 * @param {Array} items - All items
 * @param {number} page - Current page (0-indexed)
 * @returns {Array}
 */
function getPageItems(items, page) {
    const startIndex = page * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
}

// Calculate total pages
function getTotalPages(totalItems) { return Math.ceil(totalItems / ITEMS_PER_PAGE) || 1; }

// ============================================
// SYNC HELPERS
// ============================================

/* Build the sync confirmation embed and buttons
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
            `Would you like to sync ${capitalize(entityType)} app settings with Discord?` //Check if this doesnt need to be "entityName"
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

// ==== EDIT HELPERS ====

/* Get the correct target for editing based on current mode
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Session data containing mode
 * @returns {Object}
 */
function getEditTarget(entity, session) {
    if (session?.mode === 'mask') return entity.mask || entity;
    if (session?.mode === 'server' && session?.serverId) {
        const serverSettings = entity.discord?.server?.find(s => s.id === session.serverId);
        return serverSettings || entity.discord || entity;
    }
    return entity.discord || entity;
}

/* Update an entity property based on current mode
 * @param {Object} entity - The entity to update
 * @param {Object} session - Session data
 * @param {string} property - Property path to update
 * @param {*} value - New value
 */
function updateEntityProperty(entity, session, property, value) {
    const target = session?.mode === 'mask' ? 'mask' : 'discord';
    if (!entity[target]) entity[target] = {};

    const parts = property.split('.');
    let current = entity[target];

    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

// ==== CONDITION MANAGEMENT ====

/* Ensure a condition exists in the system
 * @param {System} system - System to update
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @param {string} conditionName - Name of the condition
 */
async function ensureConditionExists(system, entityType, conditionName) {
    const conditionsPath = `${entityType}s.conditions`;
    const conditions = system[`${entityType}s`]?.conditions || [];

    const exists = conditions.some(c => c.name?.toLowerCase() === conditionName.toLowerCase());
    if (!exists) {
        if (!system[`${entityType}s`]) system[`${entityType}s`] = { conditions: [], IDs: [] };
        
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

// ==== PROXY VALIDATION ====

/* Check if a proxy pattern already exists in the system
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
        if (alter.proxy?.some(p => p.toLowerCase() === proxyLower))
            return { exists: true, entity: alter, type: 'alter' };
    }

    // Check states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    for (const state of states) {
        if (state._id.toString() === excludeEntityId) continue;
        if (state.proxy?.some(p => p.toLowerCase() === proxyLower)) 
            return { exists: true, entity: state, type: 'state' };
    }

    // Check groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    for (const group of groups) {
        if (group._id.toString() === excludeEntityId) continue;
        if (group.proxy?.some(p => p.toLowerCase() === proxyLower)) 
            return { exists: true, entity: group, type: 'group' };
    }

    return { exists: false, entity: null, type: null };
}

/* Validate proxy patterns
 * @param {string[]} proxies - Array of proxy patterns
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateProxies(proxies) {
    const errors = [];

    for (const proxy of proxies) {
        if (!proxy.includes('text')) 
            errors.push(`Proxy "${proxy}" must contain "text" as a placeholder`);
        if (proxy.length > 100) 
            errors.push(`Proxy "${proxy}" is too long (max 100 characters)!!! How would you even remember that??? 😰`);
    }

    return { valid: errors.length === 0, errors };
}

/* Get proxy layout help text
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

/* Get proxy style options for select menu
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
// R2 MEDIA UTILITIES
// ============================================

/* Upload a file buffer to Cloudflare R2
 * @param {Buffer} buffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type (e.g., 'image/png', 'image/gif')
 * @param {string} userId - User's MongoDB _id
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 * @param {string} field - 'avatar', 'banner', or 'proxyAvatar'
 * @returns {Object} mediaSchema-compatible object { r2Key, url, filename, mimeType, size, uploadedAt }
 */
async function uploadMediaToR2(buffer, filename, mimeType, userId, entityType, field) {
    try {
        const ext = filename.split('.').pop() || 'bin';
        const timestamp = Date.now();
        const r2Key = `media/${entityType}/${userId}/${field}_${timestamp}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: config.r2.system.bucketName,
            Key: r2Key,
            Body: buffer,
            ContentType: mimeType,
        });

        await sysR2.send(command);

        const publicUrl = `${config.r2.system.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            url: publicUrl,
            filename: filename,
            mimeType: mimeType,
            size: buffer.length,
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error uploading media to R2:', error);
        throw error;
    }
}

/* Delete a file from Cloudflare R2
 * @param {string} r2Key - The R2 object key to delete
 */
async function deleteFromR2(r2Key) {
    try {
        if (!r2Key) return;
        const command = new DeleteObjectCommand({
            Bucket: config.r2.system.bucketName,
            Key: r2Key,
        });
        await sysR2.send(command);
    } catch (error) {
        console.error('Error deleting from R2:', error);
    }
}

/* Download a file from a URL (e.g., Discord attachment)
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer>} File content buffer
 */
function downloadFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                https.get(res.headers.location, (res2) => {
                    const chunks = [];
                    res2.on('data', (chunk) => chunks.push(chunk));
                    res2.on('end', () => resolve(Buffer.concat(chunks)));
                    res2.on('error', reject);
                });
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/* Process an already-collected attachment: validate, download, upload to R2
 * @param {Attachment} attachment - Discord attachment object
 * @param {string} fieldLabel - Label for R2 path (e.g., 'avatar', 'banner')
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} userId - Discord user ID for R2 path
 * @returns {Promise<Object>} { success, media?, message }
 */
async function handleAttachmentUpload(attachment, fieldLabel, entityType, userId) {
    if (!attachment?.contentType?.startsWith('image/')) {
        return { success: false, message: '❌ Not a valid image file. Please send PNG, JPG, GIF, or WEBP.' };
    }

    try {
        const buffer = await downloadFromUrl(attachment.url);
        const media = await uploadMediaToR2(
            buffer,
            attachment.name || 'image',
            attachment.contentType,
            userId,
            entityType,
            fieldLabel
        );
        return { success: true, media, message: '✅ Image uploaded successfully!' };
    } catch (error) {
        console.error('Error processing attachment upload:', error);
        return { success: false, message: '❌ Failed to upload image. Try again later.' };
    }
}

/* Resolve the correct nested path for a media field based on session mode + sync
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data with mode, syncWithDiscord, serverId
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @returns {Object} { target, pathParts } — target is the nested object, pathParts for setting
 */
function resolveMediaTarget(entity, session, mediaType) {
    if (session.mode === 'mask') {
        if (!entity.mask) entity.mask = {};
        if (mediaType === 'avatar') return { target: entity.mask, path: ['mask', 'avatar'] };
        if (!entity.mask.discord) entity.mask.discord = { image: {} };
        if (!entity.mask.discord.image) entity.mask.discord.image = {};
        return { target: entity.mask.discord.image, path: ['mask', 'discord', 'image', mediaType] };
    }

    if (session.mode === 'server' && session.serverId) {
        if (!entity.discord) entity.discord = {};
        if (!entity.discord.server) entity.discord.server = [];
        let serverEntry = entity.discord.server.find(s => s.id === session.serverId);
        if (!serverEntry) {
            serverEntry = { id: session.serverId };
            entity.discord.server.push(serverEntry);
        }
        return { target: serverEntry, path: ['discord', 'server', session.serverId, mediaType], serverEntry };
    }

    if (session.syncWithDiscord && mediaType === 'avatar') {
        return { target: entity, path: ['avatar'] };
    }

    if (!entity.discord) entity.discord = {};
    if (!entity.discord.image) entity.discord.image = {};
    return { target: entity.discord.image, path: ['discord', 'image', mediaType] };
}

/* Set a media field on an entity, handling R2 cleanup of old media
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @param {Object} mediaObj - The mediaSchema object to set
 */
async function setMediaField(entity, session, mediaType, mediaObj) {
    const { target, path } = resolveMediaTarget(entity, session, mediaType);

    const oldMedia = target[mediaType];
    if (oldMedia?.r2Key) {
        await deleteFromR2(oldMedia.r2Key);
    }

    target[mediaType] = mediaObj;
}

/* Resolve avatar URL with priority chain:
 * Server > Mask Proxy > Mask > Proxy > Discord/Primary (sync-dependent) > none
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveAvatarUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const syncWithDiscord = session?.syncWithDiscord ?? entity.syncWithApps?.discord;
    const serverAvatar = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.avatar?.url : null;

    return serverAvatar
        || entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.mask?.avatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || (syncWithDiscord ? entity.avatar?.url : entity.discord?.image?.avatar?.url)
        || entity.avatar?.url
        || null;
}

/* Resolve banner URL with priority chain:
 * Server > Mask > Discord
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveBannerUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const serverBanner = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.banner?.url : null;

    return serverBanner
        || entity.mask?.discord?.image?.banner?.url
        || entity.discord?.image?.banner?.url
        || null;
}

/* Resolve proxy avatar URL with priority chain:
 * Mask Proxy > Proxy > Primary Avatar
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveProxyAvatarUrl(entity, session) {
    return entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || entity.avatar?.url
        || null;
}

/* Ensure a discord.server entry exists for the current guild
 * @param {Object} entity - The entity document
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 * @returns {Object} The server entry
 */
function ensureServerEntry(entity, guildId, guildName = null) {
    if (!entity.discord) entity.discord = {};
    if (!entity.discord.server) entity.discord.server = [];
    let serverEntry = entity.discord.server.find(s => s.id === guildId);
    if (!serverEntry) {
        serverEntry = { id: guildId, name: guildName || 'Unknown Server' };
        entity.discord.server.push(serverEntry);
    }
    return serverEntry;
}

/* Build upload select menu options based on session mode + sync
 * @param {Object} session - Session data
 * @param {string} prefix - Custom ID prefix (e.g., 'alter')
 * @returns {Array<StringSelectMenuOptionBuilder>}
 */
function buildUploadOptions(session) {
    const options = [];

    if (session.mode === 'mask') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Mask Avatar').setValue('mask_avatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Discord Avatar').setValue('mask_davatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Proxy Avatar').setValue('mask_proxy').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Banner').setValue('mask_banner').setEmoji('🖼️')
        );
    } else if (session.mode === 'server') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Server Avatar').setValue('server_avatar').setEmoji('🏠'),
            new StringSelectMenuOptionBuilder().setLabel('Server Banner').setValue('server_banner').setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder().setLabel('Server Proxy Avatar').setValue('server_proxy').setEmoji('🏠')
        );
    } else {
        if (session.syncWithDiscord) {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Primary Avatar').setValue('primary_avatar').setEmoji('👤'),
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        } else {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        }
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Proxy Avatar').setValue('proxy_avatar').setEmoji('🗣️'),
            new StringSelectMenuOptionBuilder().setLabel('Banner').setValue('banner').setEmoji('🖼️')
        );
    }

    return options;
}

/* Get embed color for a system
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getSystemEmbedColor(system) {
    return system?.color || ENTITY_COLORS.system || null;
}

/* Get embed color for an entity with priority: entity.color > system.color > default
 * @param {Object} entity - Entity document (alter/state/group)
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getEntityEmbedColor(entity, system) {
    return entity?.color || system?.color || ENTITY_COLORS.system || null;
}

// ==== EXPORTS ====
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
    getProxyStyleOptions,

    // R2 media utilities
    uploadMediaToR2,
    deleteFromR2,
    downloadFromUrl,
    handleAttachmentUpload,
    resolveMediaTarget,
    setMediaField,
    resolveAvatarUrl,
    resolveBannerUrl,
    resolveProxyAvatarUrl,
    ensureServerEntry,
    buildUploadOptions,

    // Embed color helpers
    getSystemEmbedColor,
    getEntityEmbedColor
};