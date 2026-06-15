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
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const https = require('https');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Import schemas
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');

// Import notification manager
const notificationManager = require('../notificationManager');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const Guild = require('../../../schemas/guild');
const { PrivacyBucket } = require('../../../schemas/settings');

// Import config for R2
const config = require('../../../config.json');

// R2 clients imported from r2Media.js when needed

// ==== CONSTANTS =====

const constants = require('./constants');
const {
    ITEMS_PER_PAGE,
    INDEXABLE_NAME_REGEX,
    ENTITY_COLORS,
    DSM_TYPES,
    ICD_TYPES,
    DISORDER_MAP,
    DSM_DISORDER_OPTIONS,
    ICD_DISORDER_OPTIONS,
    getSystemTerm,
    getAlterTerm,
} = constants;

// Session storage (for multi-step interactions)
const sessions = require('./sessions');
const { activeSessions, sessionTimeouts } = sessions;

// ==== SESSION MANAGEMENT ====

// Generate Session ID
const generateSessionId = sessions.generateSessionId;

// Get a session by ID
const getSession = sessions.getSession;

// Set/update a session
const setSession = sessions.setSession;

// Delete a session
const deleteSession = sessions.deleteSession;

/**
 * Extract session ID from a customId string.
 * Convention: customId format is {command}_{action}_{userId}_{timestamp}
 * Session ID format is {userId}_{timestamp} (last two underscore-separated segments).
 * @param {string} customId - The Discord interaction customId
 * @returns {string} The session ID (userId_timestamp)
 */
const extractSessionId = sessions.extractSessionId;

// ==== PREFIX COMMAND ARGUMENT PARSING ====

const args = require('./args');

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
const parseArgs = args.parseArgs;

/* Extract target system from args (handles @mention, user ID, or defaults to self)
 * @param {Message} message - Discord message object
 * @param {Object} parsedArgs - Parsed arguments
 * @returns {Promise<{user: User, system: System, targetUserId: string}|null>}
 */
const resolveTargetSystem = args.resolveTargetSystem;

// ==== USER AND SYSTEM MANAGEMENT ====

const userSystem = require('./userSystem');

/* Get or create user and system for an interaction or message
 * Works with both slash commands (interaction) and prefix commands (message)
 * @param {Interaction|Message} context - Discord interaction or message
 * @returns {Promise<{user: User, system: System, isNew: boolean}>}
 */
const getOrCreateUserAndSystem = userSystem.getOrCreateUserAndSystem;

async function getUser(context) {
    return userSystem.getUser(context);
}

async function getOrCreateUser(context) {
    return userSystem.getOrCreateUser(context);
}

/* Create a new user and system */
const createNewUserAndSystem = userSystem.createNewUserAndSystem;
const createSystem = userSystem.createSystem;
const createUser = userSystem.createUser;

/* Handle new user flow for slash commands
 * Shows disorder category selection (DSM-5 / ICD-10 / Other / None / Skip)
 * @param {Interaction} interaction
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 */
const handleNewUserFlow = userSystem.handleNewUserFlow;

/* Build a select menu for disorders in a given category
 * @param {string} category - 'DSM' or 'ICD'
 * @param {string} sessionId
 * @returns {ActionRowBuilder}
 */
const buildDisorderSelectMenu = userSystem.buildDisorderSelectMenu;

// The rest of onboarding handlers are in userSystem.js
const { handleNewUserButton, showNameStep, handleNewUserModal, handleNewUserNameModal, finalizeOnboarding, requireSystem } = userSystem;

// ==== ENTITY SEARCH (CASE-INSENSITIVE) ====

const entitySearch = require('./entitySearch');

// Escape special regex characters
const escapeRegex = entitySearch.escapeRegex;

/* Find an entity (alter/state/group) by name or ID (case-insensitive)
 * @param {string} identifier - Name, alias, or ID
 * @param {System} system - System to search in
 * @param {string} entityType - 'alter', 'state', 'group', or 'any'
 * @returns {Promise<{entity: Object, type: string}|null>}
 */
const findEntity = entitySearch.findEntity;

/* Find an alter by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
const findAlterByName = entitySearch.findAlterByName;

/* Find a state by name (case-insensitive) - backward compatibility
 * @returns {Promise<State|null>}
 */
const findStateByName = entitySearch.findStateByName;

/* Find a group by name (case-insensitive) - backward compatibility
 * @returns {Promise<Group|null>}
 */
const findGroupByName = entitySearch.findGroupByName;

/* Find as many entities as possible by names/IDs
 * @param {string[]} identifiers - Array of names, aliases, or IDs
 * @param {System} system - System to search in
 * @returns {Promise<{found: Array<{entity: Object, type: string}>, notFound: string[]}>}
 */
const findMultipleEntities = entitySearch.findMultipleEntities;

// ==== PRIVACY AND VISIBILITY ====

const privacy = require('./privacy');

/* Get the privacy bucket for a viewer
 * @param {System} system - The system being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID (optional)
 * @returns {PrivacyBucket|null}
 */
const getPrivacyBucket = privacy.getPrivacyBucket;

/* Check if an entity should be visible based on privacy settings
 * @param {Object} entity - The entity (alter/state/group) to check
 * @param {PrivacyBucket} privacyBucket - The viewer's privacy bucket
 * @param {boolean} isOwner - Whether the viewer is the owner
 * @param {boolean} showFullList - Whether to show hidden items (owner only)
 * @returns {boolean}
 */
const shouldShowEntity = privacy.shouldShowEntity;

/* Check if pinging an entity is allowed
 * Priority: user master switch > entity master switch > privacy bucket restriction
 * @param {Object} entity - The entity being pinged (alter/state/group)
 * @param {string} pingedUserId - Discord ID of the user who sent the proxied message
 * @param {string} viewerDiscordId - Discord ID of the person sending the ping command
 * @returns {Promise<boolean>}
 */
const isPingAllowed = privacy.isPingAllowed;

/* Check if user is blocked by another user
 * @param {User} targetUser - The user being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID
 * @returns {boolean}
 */
const isBlocked = privacy.isBlocked;

// ==== DISPLAY HELPERS ====

const display = require('./display');

/* Get the display name for an entity, respecting closedChar settings
 * @param {Object} entity - Entity with name property
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 * @returns {string}
 */
const getDisplayName = display.getDisplayName;

/* Get a fallback display name using Discord user info when entity/system name is missing
 * @param {Object|null} fallbackUser - Discord user object (interaction.user or message.author)
 * @param {string|null} fallbackDisplayName - Pre-resolved display name (e.g. interaction.user?.displayName)
 * @returns {string}
 */
const getFallbackName = display.getFallbackName;

/* Get a property from discord element or fall back to base property
 * @param {Object} entity - The entity
 * @param {string} property - Property name to get
 * @returns {*}
 */
const getDiscordOrDefault = display.getDiscordOrDefault;

// Check if closedCharAllowed for a guild
const checkClosedCharAllowed = display.checkClosedCharAllowed;

// Validate an indexable name
const isValidIndexableName = display.isValidIndexableName;

// ============================================
// PREFIX COMMAND RESPONSE HELPERS
//  * @param {Message} message - Discord message to reply to
//  * @param {string} text - message text
// ============================================

const response = require('./response');
const { success, error, info, buildHelpEmbed } = response;

// ============================================
// SETTINGS / PROXY UTILITIES
// ============================================

const proxyValidation = require('./proxyValidation');
const {
    findEntityByNameForSystem,
    buildProxySettingsEmbed,
    buildProxySettingsComponents,
    buildProxyLayoutModal,
    buildProxyStyleModal,
    validateProxyStyle,
} = proxyValidation;

// ============================================
// NOTIFICATION SETTINGS UTILITIES
// ============================================

function getDeliveryLabel(method) {
    const labels = { dm: '📨 Discord DM', command: '💬 In Command', none: '❌ Disabled' };
    return labels[method] || '📨 Discord DM (Default)';
}

// Build notification settings embed
function buildNotificationSettingsEmbed(user) {
    const prefs = user.settings?.notificationPreferences || {};
    return new EmbedBuilder()
        .setColor('#00d4ff')
        .setTitle('🔔 Notification Settings')
        .setDescription('Configure how you receive notifications.')
        .addFields(
            { name: 'Delivery Method', value: getDeliveryLabel(prefs.friendNotifications), inline: true },
            { name: 'Friend Requests', value: prefs.friendRequests !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Friend Switches', value: prefs.friendSwitches !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'App Messages', value: prefs.appMessages !== false ? '✅ Enabled' : '❌ Disabled', inline: true }
        );
}

// Build notification settings components (delivery select + toggle buttons)
function buildNotificationSettingsComponents(sessionId, prefs) {
    const deliveryRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`settings_notif_method_${sessionId}`)
            .setPlaceholder('Choose delivery method')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Discord DM')
                    .setValue('dm')
                    .setDefault(prefs.friendNotifications === 'dm' || prefs.friendNotifications === undefined),
                new StringSelectMenuOptionBuilder()
                    .setLabel('In Command')
                    .setValue('command')
                    .setDefault(prefs.friendNotifications === 'command'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('None')
                    .setValue('none')
                    .setDefault(prefs.friendNotifications === 'none')
            )
    );

    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_friendRequests_${sessionId}`)
            .setLabel('Friend Requests')
            .setStyle(prefs.friendRequests !== false ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_friendSwitches_${sessionId}`)
            .setLabel('Friend Switches')
            .setStyle(prefs.friendSwitches !== false ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_appMessages_${sessionId}`)
            .setLabel('App Messages')
            .setStyle(prefs.appMessages !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`settings_notif_back_${sessionId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return [deliveryRow, toggleRow, backRow];
}

// ==== FORMATTING UTILITIES ====

const formatting = require('./formatting');
const {
    capitalize,
    formatValue,
    formatDate,
    formatProxies,
    parseCommaSeparated,
    parseList,
    parseNewlineSeparated,
    parseNewlineList,
    isValidColor,
    normalizeColor,
} = formatting;

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

// Imported from entityLinking.js
const { getEditTarget, updateEntityProperty } = require('./entityLinking');

// ==== CONDITION MANAGEMENT ====

// Imported from entityLinking.js
const { ensureConditionExists } = require('./entityLinking');

// ==== PROXY VALIDATION ====

const { checkProxyExists, validateProxies, getProxyLayoutHelp, getProxyStyleOptions } = proxyValidation;

// ============================================
// R2 MEDIA UTILITIES
// ============================================

const r2Media = require('./r2Media');
const {
    sysR2,
    discordR2,
    uploadMediaToR2,
    deleteFromR2,
    downloadFromUrl,
    handleAttachmentUpload,
    handlePrefixMediaUpload,
    resolveUploadBucket,
    resolveMediaTarget,
    setMediaField,
    resolveAvatarUrl,
    resolveBannerUrl,
    resolveProxyAvatarUrl,
    ensureServerEntry,
    buildUploadOptions,
} = r2Media;

// ============================================
// EMBED COLOR HELPERS
// ============================================

const embedColors = require('./embedColors');
const {
    getSystemEmbedColor,
    getEntityEmbedColor,
    resolveAlterDisplay,
} = embedColors;

// ============================================
// GUILD LOGGING
// ============================================

const logging = require('./logging');
const { sendGuildLog, buildLogEmbed } = logging;

// ============================================
// ENTITY LINKING (imported from entityLinking.js)
// ============================================

const entityLinking = require('./entityLinking');
const {
    createAndLinkEntity,
    unlinkEntityFromSystem,
    publishDeleteEvent,
    linkEntityToGroup,
    unlinkEntityFromGroup,
} = entityLinking;

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Constants
    ...constants,

    // Session management
    ...sessions,

    // Prefix command parsing
    ...args,

    // User and system management
    ...userSystem,

    // Entity search (case-insensitive)
    ...entitySearch,

    // Privacy and visibility
    ...privacy,

    // Display helpers
    ...display,

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

    // Entity-system bidirectional linking
    createAndLinkEntity,
    unlinkEntityFromSystem,
    linkEntityToGroup,
    unlinkEntityFromGroup,

    // Real-time events
    publishDeleteEvent,

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
    sysR2,
    uploadMediaToR2,
    deleteFromR2,
    downloadFromUrl,
    handleAttachmentUpload,
    handlePrefixMediaUpload,
    resolveUploadBucket,
    resolveMediaTarget,
    setMediaField,
    resolveAvatarUrl,
    resolveBannerUrl,
    resolveProxyAvatarUrl,
    ensureServerEntry,
    buildUploadOptions,

    // Embed color helpers
    getSystemEmbedColor,
    getEntityEmbedColor,
    resolveAlterDisplay,

    // Front management helpers
    updateRecentProxies,
    getBatteryEmoji,

    // Notification system
    notificationManager,
    getAndClearNotifications,
    formatNotificationEmbed,

    // Settings / proxy utilities
    findEntityByNameForSystem,
    buildProxySettingsEmbed,
    buildProxySettingsComponents,
    buildProxyLayoutModal,
    buildProxyStyleModal,
    validateProxyStyle,

    // Notification settings utilities
    getDeliveryLabel,
    buildNotificationSettingsEmbed,
    buildNotificationSettingsComponents,

    // Guild logging
    sendGuildLog,

    // Staged onboarding/import sessions for bot + frontend flows
    BotSessionManager: require('../BotSessionManager'),

    // Misc helpers (extracted to helpers.js)
    ...require('./helpers')
};

// ==== END OF EXPORTS ====