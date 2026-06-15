// Formatting Utilities
// String formatting, parsing, and validation helpers

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

module.exports = {
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
};