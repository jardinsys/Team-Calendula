/**
 * Cross-source entity merge helpers.
 *
 * When the same alter/state exists in multiple import sources (e.g. PluralKit
 * and SimplyPlural), we want ONE entity with data from all sources merged.
 *
 * Strategy:
 *   1. Track which sources contributed data via metadata.importedFrom[]
 *   2. When updating from a NEW source, only set fields that are currently empty
 *   3. Always add the new source's ID to metadata
 *   4. For arrays (pronouns), append unique values
 *
 * This prevents one source from overwriting another source's data.
 */

const SOURCE_IDS = {
    pluralkit: 'pluralKitId',
    simplyplural: 'simplyPluralId',
    octocon: 'octoconId',
    tupperbox: 'tupperboxId',
};

const SOURCE_META_KEYS = {
    pluralkit: 'pluralKitUuid',
    simplyplural: 'simplyPluralId',
};

/**
 * Check if an entity was imported from a different source than the current import.
 * @param {Object} entity - Existing Mongoose entity
 * @param {string} currentSource - The source currently being imported (e.g. 'simplyplural')
 * @returns {boolean} true if the entity has data from a different source
 */
function isCrossSourceMatch(entity, currentSource) {
    const meta = entity.metadata;
    if (!meta) return false;

    const importedFrom = meta.importedFrom;
    if (!importedFrom) return false;

    // If importedFrom is a string (old format), it's a single-source import
    if (typeof importedFrom === 'string') return importedFrom !== currentSource;

    // If importedFrom is an array, check if the current source is NOT in it
    if (Array.isArray(importedFrom)) return !importedFrom.includes(currentSource);

    return false;
}

/**
 * Merge data from a new source onto an existing entity.
 * Only sets fields that are currently empty/null/undefined.
 *
 * @param {Object} entity - Existing Mongoose entity to update
 * @param {Object} newData - Field values from the new source
 * @param {string} source - Source identifier (e.g. 'simplyplural')
 * @param {Object} [sourceIds] - Source-specific IDs to add to metadata (e.g. { simplyPluralId: '123' })
 * @returns {boolean} true if any fields were set
 */
function mergeEntityData(entity, newData, source, sourceIds = {}) {
    let changed = false;

    // ── Metadata: track all sources ──
    if (!entity.metadata) entity.metadata = {};
    if (!Array.isArray(entity.metadata.importedFrom)) {
        entity.metadata.importedFrom = entity.metadata.importedFrom
            ? [entity.metadata.importedFrom]
            : [];
    }
    if (!entity.metadata.importedFrom.includes(source)) {
        entity.metadata.importedFrom.push(source);
        changed = true;
    }

    // Add source-specific IDs
    for (const [key, value] of Object.entries(sourceIds)) {
        if (value && !entity.metadata[key]) {
            entity.metadata[key] = value;
            changed = true;
        }
    }

    // ── Scalar fields: only set if currently empty ──
    if (newData.description && !entity.description) {
        entity.description = newData.description;
        changed = true;
    }
    if (newData.pronouns && (!entity.pronouns || entity.pronouns.length === 0)) {
        entity.pronouns = Array.isArray(newData.pronouns) ? newData.pronouns : [newData.pronouns];
        changed = true;
    }
    if (newData.color && !entity.color) {
        entity.color = newData.color;
        changed = true;
    }
    if (newData.birthday && !entity.birthday) {
        entity.birthday = newData.birthday;
        changed = true;
    }

    // ── Avatar/Banner: only set if currently empty ──
    if (newData.avatar?.url && !entity.avatar?.url) {
        entity.avatar = newData.avatar;
        changed = true;
    }
    if (newData.banner?.url && !entity.banner?.url) {
        entity.banner = newData.banner;
        changed = true;
    }

    // ── Discord-specific fields: only set if currently empty ──
    if (newData.discord) {
        if (!entity.discord) entity.discord = {};
        if (newData.discord.name?.display && !entity.discord.name?.display) {
            entity.discord.name = entity.discord.name || {};
            entity.discord.name.display = newData.discord.name.display;
            changed = true;
        }
        if (newData.discord.description && !entity.discord.description) {
            entity.discord.description = newData.discord.description;
            changed = true;
        }
        if (newData.discord.color && !entity.discord.color) {
            entity.discord.color = newData.discord.color;
            changed = true;
        }
        if (newData.discord.image?.avatar?.url && !entity.discord.image?.avatar?.url) {
            entity.discord.image = entity.discord.image || {};
            entity.discord.image.avatar = newData.discord.image.avatar;
            changed = true;
        }
        if (newData.discord.image?.banner?.url && !entity.discord.image?.banner?.url) {
            entity.discord.image = entity.discord.image || {};
            entity.discord.image.banner = newData.discord.image.banner;
            changed = true;
        }
    }

    // ── Name display: only set if currently empty ──
    if (newData.name?.display && !entity.name?.display) {
        entity.name = entity.name || {};
        entity.name.display = newData.name.display;
        changed = true;
    }

    // ── Proxy patterns: append unique ──
    if (Array.isArray(newData.proxy) && newData.proxy.length > 0) {
        if (!Array.isArray(entity.proxy)) entity.proxy = [];
        for (const p of newData.proxy) {
            const exists = entity.proxy.some(ep =>
                ep.prefix === p.prefix && ep.suffix === p.suffix
            );
            if (!exists) {
                entity.proxy.push(p);
                changed = true;
            }
        }
    }

    return changed;
}

/**
 * Convenience: merge entity data, but only if this is a cross-source match.
 * If the entity was already imported from the same source, returns false (no merge).
 *
 * @param {Object} entity - Existing entity
 * @param {Object} newData - Data from the new source
 * @param {string} source - Source identifier
 * @param {Object} [sourceIds] - Source-specific IDs
 * @returns {boolean} true if a cross-source merge was performed
 */
function crossSourceMerge(entity, newData, source, sourceIds = {}) {
    if (!isCrossSourceMatch(entity, source)) return false;
    return mergeEntityData(entity, newData, source, sourceIds);
}

module.exports = {
    isCrossSourceMatch,
    mergeEntityData,
    crossSourceMerge,
    SOURCE_IDS,
    SOURCE_META_KEYS,
};
