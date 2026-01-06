// Systemiser Shared Utilities
// Used by alter.js, state.js, group.js, and other system-related commands

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

// Session storage for multi-step interactions
const activeSessions = new Map();

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Generate a unique session ID
 * @param {string} odUserId - Discord user ID
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
}

/**
 * Delete a session
 * @param {string} sessionId 
 */
function deleteSession(sessionId) {
    activeSessions.delete(sessionId);
}

/**
 * Extract session ID from a custom ID string (usually the last part after underscore)
 * @param {string} customId 
 * @returns {string}
 */
function extractSessionId(customId) {
    const parts = customId.split('_');
    return parts[parts.length - 1];
}

// ============================================
// USER AND SYSTEM MANAGEMENT
// ============================================

/**
 * Get or identify if user needs to be created
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<{user: User|null, system: System|null, isNew: boolean}>}
 */
async function getOrCreateUserAndSystem(interaction) {
    let user = await User.findOne({ discordID: interaction.user.id });
    
    if (!user) {
        return { user: null, system: null, isNew: true };
    }

    let system = null;
    if (user.systemID) {
        system = await System.findById(user.systemID);
    }

    return { user, system, isNew: false };
}

/**
 * Create a new user and system with default settings
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<{user: User, system: System}>}
 */
async function createNewUserAndSystem(interaction) {
    // Create new user
    const newUser = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: interaction.user.id,
        joinedAt: new Date(),
        discord: {
            name: {
                indexable: interaction.user.username.toLowerCase().replace(/[^a-z0-9\-_]/g, ''),
                display: interaction.user.displayName || interaction.user.username
            }
        }
    });

    // Create default privacy buckets
    const defaultBucket = new PrivacyBucket({
        _id: new mongoose.Types.ObjectId(),
        name: 'Default',
        friends: []
    });

    const friendsBucket = new PrivacyBucket({
        _id: new mongoose.Types.ObjectId(),
        name: 'Friends',
        friends: []
    });

    // Create new system with default conditions
    const newSystem = new System({
        users: [newUser._id],
        name: {
            indexable: `system-${interaction.user.id}`,
            display: `${interaction.user.displayName || interaction.user.username}'s System`
        },
        alters: {
            conditions: [{
                name: 'dormant',
                settings: {
                    hide_to_self: false,
                    include_in_Count: false
                }
            }],
            IDs: []
        },
        states: {
            conditions: [{
                name: 'remission',
                settings: {
                    hide_to_self: false,
                    include_in_Count: false
                }
            }],
            IDs: []
        },
        groups: {
            types: [],
            conditions: [],
            IDs: []
        },
        privacyBuckets: [defaultBucket, friendsBucket],
        setting: {
            friendAutoBucket: friendsBucket._id.toString()
        }
    });

    // Link user to system
    newUser.systemID = newSystem._id;

    await newUser.save();
    await newSystem.save();

    return { user: newUser, system: newSystem };
}

/**
 * Handle the new user flow with buttons
 * @param {Interaction} interaction 
 * @param {string} entityType - 'alter', 'state', or 'group'
 */
async function handleNewUserFlow(interaction, entityType = 'alter') {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Welcome to Systemiser! 🎡')
        .setDescription('It looks like this is your first time here. Do you already have a system set up?')
        .setFooter({ text: 'Select an option below to continue' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`new_user_has_system_${entityType}`)
                .setLabel('Yes, I have a system')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`new_user_no_system_${entityType}`)
                .setLabel('No, create new system')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: true
    });
}

/**
 * Handle the new user button response
 * @param {Interaction} interaction 
 * @param {string} entityType 
 * @returns {Promise<{user: User, system: System}|null>}
 */
async function handleNewUserButton(interaction, entityType) {
    const customId = interaction.customId;
    
    if (customId === `new_user_has_system_${entityType}`) {
        await interaction.update({
            content: '🔗 Please contact support to link your existing system, or use the web app to connect your accounts.',
            embeds: [],
            components: []
        });
        return null;
    }

    if (customId === `new_user_no_system_${entityType}`) {
        const { user, system } = await createNewUserAndSystem(interaction);
        await interaction.update({
            content: `✅ Welcome! Your system has been created.\n\n**System ID:** ${system._id}\n**Your Friend ID:** ${user.friendID}\n\nUse \`/${entityType} new\` to create your first ${entityType}!`,
            embeds: [],
            components: []
        });
        return { user, system };
    }

    return null;
}

// ============================================
// PRIVACY AND VISIBILITY
// ============================================

/**
 * Get the appropriate privacy bucket for a viewer
 * @param {System} system - The system being viewed
 * @param {string} discordUserId - The viewer's Discord ID
 * @param {string} guildId - The current guild ID
 * @returns {PrivacyBucket|null}
 */
function getPrivacyBucket(system, discordUserId, guildId) {
    if (!system || !system.privacyBuckets) return null;

    // Check all privacy buckets for the user
    for (const bucket of system.privacyBuckets) {
        if (bucket.friends) {
            for (const friend of bucket.friends) {
                if (friend.discordUserID === discordUserId || friend.discordGuildID === guildId) {
                    return bucket;
                }
            }
        }
    }

    // Return default bucket if not found in any specific bucket
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
    if (isOwner) {
        // Owner can see all, unless hideToSelf is enabled and not showing full list
        // For now, owners see everything
        return true;
    }

    if (!privacyBucket) return false;

    // Check privacy settings for this entity
    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);
    if (entityPrivacy?.settings?.hidden === false) {
        return false;
    }

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
// ENTITY SEARCH HELPERS
// ============================================

/**
 * Find an alter by name (indexable or alias)
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
async function findAlterByName(name, system) {
    const searchName = name.toLowerCase();
    const alters = await Alter.find({
        _id: { $in: system.alters?.IDs || [] }
    });

    // Search by indexable name first
    let alter = alters.find(a => a.name?.indexable?.toLowerCase() === searchName);
    
    // If not found, search through aliases
    if (!alter) {
        alter = alters.find(a => 
            a.name?.aliases?.some(alias => alias.toLowerCase() === searchName)
        );
    }

    return alter || null;
}

/**
 * Find a state by name (indexable or alias)
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<State|null>}
 */
async function findStateByName(name, system) {
    const searchName = name.toLowerCase();
    const states = await State.find({
        _id: { $in: system.states?.IDs || [] }
    });

    let state = states.find(s => s.name?.indexable?.toLowerCase() === searchName);
    
    if (!state) {
        state = states.find(s => 
            s.name?.aliases?.some(alias => alias.toLowerCase() === searchName)
        );
    }

    return state || null;
}

/**
 * Find a group by name (indexable or alias)
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Group|null>}
 */
async function findGroupByName(name, system) {
    const searchName = name.toLowerCase();
    const groups = await Group.find({
        _id: { $in: system.groups?.IDs || [] }
    });

    let group = groups.find(g => g.name?.indexable?.toLowerCase() === searchName);
    
    if (!group) {
        group = groups.find(g => 
            g.name?.aliases?.some(alias => alias.toLowerCase() === searchName)
        );
    }

    return group || null;
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
 * @param {string} prefix - Button ID prefix (e.g., 'alter', 'state', 'group')
 * @returns {ActionRowBuilder[]}
 */
function buildListButtons(totalItems, currentPage, isOwner, showFullList, sessionId, prefix) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    const rows = [];

    // Navigation row
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

    // Toggle full list button (owner only)
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
// SYNC WITH DISCORD HELPERS
// ============================================

/**
 * Build the sync confirmation embed and buttons
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @param {string} entityName - Name of the entity
 * @param {string} sessionId - Session ID
 * @param {string} action - 'new' or 'edit'
 * @returns {{embed: EmbedBuilder, buttons: ActionRowBuilder}}
 */
function buildSyncConfirmation(entityType, entityName, sessionId, action = 'edit') {
    const colors = {
        alter: '#FFA500',
        state: '#9B59B6',
        group: '#3498DB'
    };

    const embed = new EmbedBuilder()
        .setColor(colors[entityType] || '#FFA500')
        .setTitle(action === 'new' ? `Create New ${capitalize(entityType)}` : `Edit ${capitalize(entityType)}: ${entityName}`)
        .setDescription(
            'Would you like changes to sync with Discord?\n\n' +
            '*If yes, edits will apply to your main profile. If no, edits will be Discord-specific.*'
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${entityType}_${action}_sync_yes_${sessionId}`)
                .setLabel('Yes, sync with Discord')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`${entityType}_${action}_sync_no_${sessionId}`)
                .setLabel('No, Discord-specific')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embed, buttons };
}

// ============================================
// EDIT INTERFACE HELPERS
// ============================================

/**
 * Get the target object for edits based on mode and sync settings
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Current session with mode and sync info
 * @returns {Object} - The object to read/write properties from/to
 */
function getEditTarget(entity, session) {
    if (session.mode === 'mask') {
        return entity.mask || {};
    } else if (session.mode === 'server' || !session.syncWithDiscord) {
        return entity.discord || {};
    }
    return entity;
}

/**
 * Update entity property based on mode and sync settings
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Current session
 * @param {string} path - Property path (e.g., 'name.display', 'description')
 * @param {*} value - New value
 */
function updateEntityProperty(entity, session, path, value) {
    const parts = path.split('.');
    let target;

    if (session.mode === 'mask') {
        if (!entity.mask) entity.mask = {};
        target = entity.mask;
    } else if (session.mode === 'server' || !session.syncWithDiscord) {
        if (!entity.discord) entity.discord = {};
        target = entity.discord;
    } else {
        target = entity;
    }

    // Navigate to nested property
    for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
    }

    // Set the value
    const finalKey = parts[parts.length - 1];
    if (value !== undefined && value !== null && value !== '') {
        target[finalKey] = value;
    }
}

// ============================================
// CONDITION MANAGEMENT
// ============================================

/**
 * Add a condition to the system if it doesn't exist
 * @param {System} system - The system
 * @param {string} entityType - 'alters' or 'states'
 * @param {string} conditionName - Name of the condition
 */
async function ensureConditionExists(system, entityType, conditionName) {
    const conditions = system[entityType]?.conditions || [];
    const exists = conditions.some(c => c.name === conditionName);
    
    if (!exists) {
        if (!system[entityType]) system[entityType] = { conditions: [], IDs: [] };
        if (!system[entityType].conditions) system[entityType].conditions = [];
        
        system[entityType].conditions.push({
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
// UTILITY FUNCTIONS
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
 * Parse comma-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse newline-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseNewlineSeparated(str) {
    if (!str) return [];
    return str.split('\n').map(s => s.trim()).filter(Boolean);
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
 * Format a date for display
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '*Not set*';
    return new Date(date).toLocaleDateString();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Constants
    ITEMS_PER_PAGE,
    INDEXABLE_NAME_REGEX,
    
    // Session management
    generateSessionId,
    getSession,
    setSession,
    deleteSession,
    extractSessionId,
    activeSessions,
    
    // User and system management
    getOrCreateUserAndSystem,
    createNewUserAndSystem,
    handleNewUserFlow,
    handleNewUserButton,
    
    // Privacy and visibility
    getPrivacyBucket,
    shouldShowEntity,
    isBlocked,
    
    // Display helpers
    getDisplayName,
    getDiscordOrDefault,
    checkClosedCharAllowed,
    isValidIndexableName,
    
    // Entity search
    findAlterByName,
    findStateByName,
    findGroupByName,
    
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
    
    // Utilities
    capitalize,
    parseCommaSeparated,
    parseNewlineSeparated,
    formatProxies,
    formatDate
};