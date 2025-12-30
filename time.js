/**
 * Utility functions for converting between ISO Date and Unix timestamps
 */

/**
 * Convert ISO Date (MongoDB Date) to Unix timestamp (seconds)
 * @param {Date} date - JavaScript/MongoDB Date object
 * @returns {number} Unix timestamp in seconds
 */
function dateToTimestamp(date) {
    if (!date) {
        throw new Error('Date is required');
    }

    // Handle if date is already a Date object or convert string to Date
    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date provided');
    }

    return Math.floor(dateObj.getTime() / 1000);
}

/**
 * Convert Unix timestamp (seconds) to JavaScript Date object
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {Date} JavaScript Date object
 */
function timestampToDate(timestamp) {
    if (typeof timestamp !== 'number') {
        throw new Error('Timestamp must be a number');
    }

    if (timestamp < 0) {
        throw new Error('Timestamp must be positive');
    }

    // To convert seconds to milliseconds (required)
    return new Date(timestamp * 1000);
}

/**
 * Convert ISO Date to Discord-formatted timestamp
 * @param {Date} date - JavaScript/MongoDB Date object
 * @param {string} style - Discord timestamp style (t, T, d, D, f, F, R)
 * @returns {string} Discord-formatted timestamp string
 * 
 * About Discord Timestamps:
 *   't' - Short Time:          16:20
 *   'T' - Long Time:           16:20:30
 *   'd' - Short Date:          20/04/2021
 *   'D' - Long Date:           20 April 2021
 *   'f' - Short Date/Time:     20 April 2021 16:20 (default)
 *   'F' - Long Date/Time:      Tuesday, 20 April 2021 16:20
 *   'R' - Relative Time:       2 months ago (updates dynamically)
 */
function dateToDiscordTimestamp(date, style = 'f') {
    const timestamp = dateToTimestamp(date);
    return `<t:${timestamp}:${style}>`;
}

/**
 * Get current Unix timestamp
 * @returns {number} Current Unix timestamp in seconds
 */
function now() {
    return Math.floor(Date.now() / 1000);
}

module.exports = {
    dateToTimestamp,
    timestampToDate,
    dateToDiscordTimestamp,
    now
};