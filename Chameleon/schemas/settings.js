const mongoose = require("mongoose");
const sysDB = require("../database");

// ============================================
// PRIVACY SCHEMAS (per entity type)
// ============================================

// System-level privacy settings
const systemPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    birthday: Boolean,
    pronouns: Boolean,
    metadata: Boolean,
    caution: Boolean,
    hidden: Boolean,
    list: Boolean,
    front: Boolean,
});

// Group privacy settings
const groupPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    list: Boolean,
    metadata: Boolean,
    hidden: Boolean,
    caution: Boolean,
    allowPing: Boolean,
    aliases: {
        all: Boolean,
        allowed: [String]
    }
});

// Alter/State privacy settings (shared)
const alterPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    birthday: Boolean,
    pronouns: Boolean,
    metadata: Boolean,
    hidden: Boolean,
    proxies: Boolean,
    caution: Boolean,
    allowPing: Boolean,
    aliases: {
        all: Boolean,
        allowed: [String]
    }
});

// ============================================
// PRIVACY BUCKET TEMPLATES (default configs)
// ============================================

/**
 * Default privacy bucket templates.
 * These define the baseline settings for each bucket type.
 * Entities can override individual fields; non-overridden fields fall back to template.
 */
const PRIVACY_BUCKET_TEMPLATES = {
    Strangers: {
        alter: {
            mask: false,
            description: false,
            banner: false,
            avatar: false,
            birthday: false,
            pronouns: false,
            metadata: false,
            hidden: true,
            proxies: false,
            caution: false,
            allowPing: false,
            aliases: { all: false, allowed: [] }
        },
        group: {
            mask: false,
            description: false,
            banner: false,
            avatar: false,
            list: false,
            metadata: false,
            hidden: true,
            caution: false,
            allowPing: false,
            aliases: { all: false, allowed: [] }
        },
        system: {
            mask: false,
            description: false,
            banner: false,
            avatar: false,
            birthday: false,
            pronouns: false,
            metadata: false,
            caution: false,
            hidden: true,
            list: false,
            front: false
        }
    },
    Friends: {
        alter: {
            mask: false,
            description: true,
            banner: true,
            avatar: true,
            birthday: false,
            pronouns: true,
            metadata: false,
            hidden: false,
            proxies: true,
            caution: false,
            allowPing: true,
            aliases: { all: false, allowed: [] }
        },
        group: {
            mask: false,
            description: true,
            banner: true,
            avatar: true,
            list: true,
            metadata: false,
            hidden: false,
            caution: false,
            allowPing: true,
            aliases: { all: false, allowed: [] }
        },
        system: {
            mask: false,
            description: true,
            banner: true,
            avatar: true,
            birthday: false,
            pronouns: true,
            metadata: false,
            caution: false,
            hidden: false,
            list: true,
            front: true
        }
    }
};

/**
 * Get the default template for a bucket name and entity type.
 * Falls back to Friends template for unknown buckets (more permissive).
 */
function getBucketTemplate(bucketName, entityType) {
    const template = PRIVACY_BUCKET_TEMPLATES[bucketName];
    if (!template) {
        // Unknown bucket -> fall back to Friends (more permissive) or Strangers if preferred
        return PRIVACY_BUCKET_TEMPLATES.Friends[entityType] || {};
    }
    return template[entityType] || {};
}

/**
 * Merge entity-specific overrides with bucket template.
 * Non-overridden fields use template defaults.
 */
function mergePrivacySettings(bucketName, entityType, overrides = {}) {
    const template = getBucketTemplate(bucketName, entityType);
    return { ...template, ...overrides };
}

// ============================================
// PRIVACY BUCKET MODEL (registry)
// ============================================

const privacyBucketSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    name: String,
    friends: [{
        friendID: String,
        discordUserID: String,
        discordGuildID: String,
    }]
});

const PrivacyBucket = sysDB.model('PrivacyBucket', privacyBucketSchema);

module.exports = {
    // Schemas
    systemPrivacySchema,
    groupPrivacySchema,
    alterPrivacySchema,

    // Templates & helpers
    PRIVACY_BUCKET_TEMPLATES,
    getBucketTemplate,
    mergePrivacySettings,

    // Model
    PrivacyBucket
};