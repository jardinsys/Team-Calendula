/**
 * Shared import helper functions.
 * Extracted from import_functions.js — used by all source-specific import modules.
 *
 * @module import/helpers
 */

const { TARGET_DISCORD } = require('./constants');
const { syncImageToR2 } = require('./r2_sync');
const { checkProxyExists } = require('../bot_utils');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');

/**
 * Sync entity images (avatar, banner) to R2 after creation.
 * Updates entity in-place with R2-backed mediaSchema objects.
 * @param {import('../../../types').BaseEntity} entity - The Alter/State/Group document (not yet saved)
 * @param {Record<string, any>} sourceData - Source data with avatar_url, banner, etc.
 * @param {'Alter' | 'State' | 'Group'} entityType - Entity type
 * @param {import('../../../types').System} system - System document (for userId)
 * @param {'app' | 'discord'} target - Which profile to sync to
 * @returns {Promise<void>}
 */
async function syncEntityImages(entity, sourceData, entityType, system, target, dryRun) {
    if (dryRun) return; // Skip R2 uploads during dryRun — images won't be referenced
    const userId = system.users?.[0] || system.discordId;
    if (!userId) return;

    // Extract avatar/banner from various source data formats
    let avatarUrl = null;
    let bannerUrl = null;

    if (sourceData.avatar_url) {
        avatarUrl = sourceData.avatar_url;
    } else if (sourceData.avatarUrl) {
        avatarUrl = sourceData.avatarUrl;
    } else if (sourceData.icon) { // PluralKit group icon
        avatarUrl = sourceData.icon;
    }

    if (sourceData.banner) {
        bannerUrl = sourceData.banner;
    } else if (sourceData.bannerUrl) {
        bannerUrl = sourceData.bannerUrl;
    }

    // Sync avatar
    if (avatarUrl) {
        const media = await syncImageToR2(avatarUrl, userId, entityType, 'avatar');
        if (media) {
            if (target === TARGET_DISCORD) {
                entity.discord = entity.discord || {};
                entity.discord.image = entity.discord.image || {};
                entity.discord.image.avatar = media;
            } else {
                entity.avatar = media;
            }
        }
    }

    // Sync banner
    if (bannerUrl) {
        const media = await syncImageToR2(bannerUrl, userId, entityType, 'banner');
        if (media) {
            if (target === TARGET_DISCORD) {
                entity.discord = entity.discord || {};
                entity.discord.image = entity.discord.image || {};
                entity.discord.image.banner = media;
            } else {
                entity.banner = media;
            }
        }
    }
}

// Filter out proxy patterns that conflict with existing entities
async function filterConflictingProxies(entity, system) {
    if (!entity.proxy?.length) return;
    const valid = [];
    for (const proxy of entity.proxy) {
        const { exists } = await checkProxyExists(proxy, system, entity._id.toString());
        if (!exists) valid.push(proxy);
    }
    entity.proxy = valid;
}

// ============================================
// PRE-IMPORT BACKUP
// ============================================

async function createBackup(system, source) {
    // Skip backup for in-memory systems (no _id means plain JSON from systemConfig)
    if (!system?._id) return null;

    const backup = {
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        source,
        // Member/group counts respecting include_in_Count on conditions
        memberCount: system.alters?.IDs?.length || 0,
        groupCount: system.groups?.IDs?.length || 0,
        snapshot: {
            alters: await Alter.find({ _id: { $in: system.alters?.IDs || [] } }).lean(),
            states: await State.find({ _id: { $in: system.states?.IDs || [] } }).lean(),
            groups: await Group.find({ _id: { $in: system.groups?.IDs || [] } }).lean()
        }
    };

    if (!system.metadata) system.metadata = {};
    if (!system.metadata.importBackups) system.metadata.importBackups = [];
    system.metadata.importBackups.push(backup);

    // Clean expired backups
    system.metadata.importBackups = system.metadata.importBackups.filter(
        b => b.expiresAt > new Date()
    );

    // Keep only last 3 non-expired backups
    if (system.metadata.importBackups.length > 3) {
        system.metadata.importBackups = system.metadata.importBackups.slice(-3);
    }

    await system.save();
    return backup;
}

// ============================================
// SOURCE ENTITY TERM HELPER
// ============================================

function getSourceEntityTerm(source) {
    const terms = { pluralkit: 'members', simplyplural: 'members', octocon: 'alters', tupperbox: 'tuppers' };
    return terms[source] || 'entities';
}

// ============================================
// GROUP LINKING HELPER
// ============================================

async function addEntityToGroup(entity, group, entityType, options = {}) {
    const dryRun = options.dryRun;
    if (entityType === 'alter') {
        group.alterIDs = group.alterIDs || [];
        if (!group.alterIDs.includes(entity._id)) {
            group.alterIDs.push(entity._id);
            if (!dryRun) await group.save();
        }
        entity.groupsIDs = entity.groupsIDs || [];
        if (!entity.groupsIDs.includes(group._id)) {
            entity.groupsIDs.push(group._id);
            if (!dryRun) await entity.save();
        }
    } else if (entityType === 'state') {
        group.stateIDs = group.stateIDs || [];
        if (!group.stateIDs.includes(entity._id)) {
            group.stateIDs.push(entity._id);
            if (!dryRun) await group.save();
        }
        entity.groupIDs = entity.groupIDs || [];
        if (!entity.groupIDs.includes(group._id)) {
            entity.groupIDs.push(group._id);
            if (!dryRun) await entity.save();
        }
    }
}

// ============================================
// MEMBER SELECTION FILTER
// ============================================

function isMemberSelected(sourceId, options) {
    if (!options.selectedMemberIds) return true;
    if (options.selectedMemberIds instanceof Set) return options.selectedMemberIds.has(sourceId);
    if (Array.isArray(options.selectedMemberIds)) return options.selectedMemberIds.includes(sourceId);
    return true;
}

// ============================================
// PRIVACY BUCKET ASSIGNMENT
// ============================================

function assignPrivateBuckets(entity, privacySettings, entityType) {
    if (!privacySettings || !entity.setting) return;

    entity.setting.privacy = entity.setting.privacy || [];
    const defaultBucket = entity.setting.privacy.find(p => p.bucket === 'default');
    if (!defaultBucket) {
        entity.setting.privacy.push({ bucket: 'default', settings: {} });
    }

    for (const [field, isPrivate] of Object.entries(privacySettings)) {
        if (isPrivate) {
            const priv = entity.setting.privacy.find(p => p.bucket === 'default');
            if (priv) {
                priv.settings[field] = true;
            }
        }
    }
}

module.exports = {
    syncEntityImages,
    filterConflictingProxies,
    createBackup,
    getSourceEntityTerm,
    addEntityToGroup,
    isMemberSelected,
    assignPrivateBuckets,
};
