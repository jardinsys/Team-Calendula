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
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const Guild = require('../../../schemas/guild');
const { PrivacyBucket } = require('../../../schemas/settings');

// Import notification manager
const notificationManager = require('../notificationManager');

// Import config for R2
const config = require('../../../config.json');

// R2 clients imported from r2Media.js when needed

// ==== CONSTANTS =====
// Re-exported from constants.js via spread at bottom
const constants = require('./constants');

// Session storage (for multi-step interactions)
const sessions = require('./sessions');
const { activeSessions, sessionTimeouts } = sessions;

// ==== SESSION MANAGEMENT ====
// Re-exported from sessions.js via spread at bottom

const args = require('./args');
// ==== PREFIX COMMAND ARGUMENT PARSING ====
// Re-exported from args.js via spread at bottom

const userSystem = require('./userSystem');
// ==== USER AND SYSTEM MANAGEMENT ====
// Re-exported from userSystem.js via spread at bottom

const entitySearch = require('./entitySearch');
// ==== ENTITY SEARCH (CASE-INSENSITIVE) ====
// Re-exported from entitySearch.js via spread at bottom

const privacy = require('./privacy');
// ==== PRIVACY AND VISIBILITY ====
// Re-exported from privacy.js via spread at bottom

const display = require('./display');
// ==== DISPLAY HELPERS ====
// Re-exported from display.js via spread at bottom

const response = require('./response');
// ============================================
// PREFIX COMMAND RESPONSE HELPERS
// Re-exported from response.js via spread at bottom
// ============================================

const formatting = require('./formatting');
const proxyValidation = require('./proxyValidation');
const entityLinking = require('./entityLinking');
const r2Media = require('./r2Media');
const embedColors = require('./embedColors');
const logging = require('./logging');
const helpers = require('./helpers');
// ============================================
// SETTINGS / PROXY UTILITIES
// Re-exported from proxyValidation.js via spread at bottom
// ============================================

// ============================================
// NOTIFICATION SETTINGS UTILITIES (local, not split)
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

// ==== LIST BUILDING HELPERS (local, not split) ====

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
// SYNC HELPERS (local, not split)
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
// Re-exported from entityLinking.js via spread at bottom

// ==== CONDITION MANAGEMENT ====
// Re-exported from entityLinking.js via spread at bottom

// ==== PROXY VALIDATION ====
// Re-exported from proxyValidation.js via spread at bottom

// ============================================
// R2 MEDIA UTILITIES
// Re-exported from r2Media.js via spread at bottom
// ============================================

// ============================================
// EMBED COLOR HELPERS
// Re-exported from embedColors.js via spread at bottom
// ============================================

// ============================================
// GUILD LOGGING
// Re-exported from logging.js via spread at bottom
// ============================================

// ============================================
// ENTITY LINKING (from entityLinking.js)
// Re-exported via spread at bottom
// ============================================

// ============================================
// EXPORTS — All modules spread, no duplicates
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
    ...response,

    // Formatting utilities
    ...formatting,

    // Proxy validation
    ...proxyValidation,

    // Entity linking
    ...entityLinking,

    // R2 media utilities
    ...r2Media,

    // Embed color helpers
    ...embedColors,

    // Guild logging
    ...logging,

    // Notification settings utilities (local)
    getDeliveryLabel,
    buildNotificationSettingsEmbed,
    buildNotificationSettingsComponents,

    // List helpers (local)
    buildListButtons,
    getPageItems,
    getTotalPages,

    // Sync helpers (local)
    buildSyncConfirmation,

    // Front management helpers (from helpers.js via spread)
    // updateRecentProxies, getBatteryEmoji — already in ...helpers

    // Notification system (from helpers.js via spread)
    // notificationManager, getAndClearNotifications, formatNotificationEmbed — already in ...helpers

    // Settings / proxy utilities (from proxyValidation.js via spread)
    // findEntityByNameForSystem, buildProxySettingsEmbed, etc. — already in ...proxyValidation

    // Staged onboarding/import sessions for bot + frontend flows
    BotSessionManager: require('./BotSessionManager'),

    // Misc helpers (extracted to helpers.js)
    ...require('./helpers')
};

// ==== END OF EXPORTS ====