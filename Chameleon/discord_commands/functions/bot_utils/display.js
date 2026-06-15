// Display helpers extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

const { INDEXABLE_NAME_REGEX } = require('./constants');
const Guild = require('../../schemas/guild');

/* Get the display name for an entity, respecting closedChar settings
 * @param {Object} entity - Entity with name property
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 * @returns {string}
 */
function getDisplayName(entity, closedCharAllowed = true) {
    if (!closedCharAllowed && entity.name?.closedNameDisplay) return entity.name.closedNameDisplay;
    return entity.name?.display || entity.name?.indexable || '';
}

/* Get a fallback display name using Discord user info when entity/system name is missing
 * @param {Object|null} fallbackUser - Discord user object (interaction.user or message.author)
 * @param {string|null} fallbackDisplayName - Pre-resolved display name (e.g. interaction.user?.displayName)
 * @returns {string}
 */
function getFallbackName(fallbackUser, fallbackDisplayName) {
    return fallbackDisplayName || fallbackUser?.displayName || fallbackUser?.username || 'Unknown';
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
    const guildSettings = await Guild.findOne({ discordId: guild.id });
    return guildSettings?.settings?.closedCharAllowed !== false;
}

// Validate an indexable name
function isValidIndexableName(name) { return INDEXABLE_NAME_REGEX.test(name); }

module.exports = {
    getDisplayName,
    getFallbackName,
    getDiscordOrDefault,
    checkClosedCharAllowed,
    isValidIndexableName,
};
