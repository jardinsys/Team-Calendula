/**
 * Shared sanitization utilities
 * Used by API routes (server) and frontend (client)
 */

/**
 * Strip HTML tags and decode entities
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .trim();
}

/**
 * Sanitize a string for safe storage (removes script tags, dangerous attributes)
 * Allows basic HTML for rich text but removes XSS vectors
 * @param {string} input - Raw string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
}

/**
 * Sanitize a tag name (strip HTML, trim, limit length)
 * @param {string} tag - Raw tag
 * @returns {string} Sanitized tag
 */
function sanitizeTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    return stripHtml(tag).substring(0, 50).trim();
}

/**
 * Generate a text preview from HTML content
 * @param {string} html - HTML content
 * @param {number} maxLength - Max preview length
 * @returns {string} Plain text preview
 */
function generatePreview(html, maxLength = 200) {
    if (!html) return '';
    return stripHtml(html).substring(0, maxLength);
}

module.exports = { stripHtml, sanitizeInput, sanitizeTag, generatePreview };
