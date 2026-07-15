/**
 * Entity Base — shared fields, sub-schemas, and helpers for Alter / State / Group.
 *
 * Usage:
 *   const { createEntitySchema, applyEntityDefaults } = require('./entityBase');
 *   const schema = createEntitySchema({ /* entity-specific fields *\/ }, privacySchema);
 *   applyEntityDefaults(schema, 'alter');
 */

const mongoose = require('mongoose');
const mediaSchema = require('../../media');
const triggerSchema = require('../../TigerLily/schemas/trigger.js');
const { snowflake } = require('./snowflakeHelper');

// ─── Shared sub-schemas ───────────────────────────────────────

const maskDiscordSchema = {
    name: { display: String, openCharDisplay: String },
    description: String,
    color: String,
    image: {
        avatar: mediaSchema,
        banner: mediaSchema,
        proxyAvatar: mediaSchema,
    },
    pronounSeparator: String,
};

const maskSchema = {
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
    },
    description: String,
    color: String,
    avatar: mediaSchema,
    discord: maskDiscordSchema,
};

const entityDiscordSchema = {
    name: { display: String, openCharDisplay: String },
    description: String,
    color: String,
    image: {
        avatar: mediaSchema,
        banner: mediaSchema,
        proxyAvatar: mediaSchema,
    },
    pronounSeparator: String,
    server: [{
        id: String,
        name: String,
        description: String,
        avatar: mediaSchema,
        banner: mediaSchema,
        proxyAvatar: mediaSchema,
        pronounSeparator: String,
    }],
    metadata: {
        messageCount: { type: Number, integer: true, default: 0 },
        lastMessageTime: Date,
    },
};

// ─── Entity-specific sub-schemas ──────────────────────────────

const alterConnectedStateSchema = {
    connected_id: String,
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
    },
    avatar: mediaSchema,
    description: String,
    caution: {
        c_type: String,
        detail: String,
        triggers: [triggerSchema],
    },
};

// ─── Shared entity fields (factory — returns fresh object each time) ──

function entityFields() {
    return {
        id: {
            type: String,
            default: () => snowflake.generate(),
            unique: true,
        },
        systemID: String,
        createdAt: { type: Date, default: Date.now },
        // Custom attributes imported from external sources (SP, PK, etc.)
        // System defines which attributes exist; entities store values here
        customAttributes: [{ name: String, value: String }],
        syncWithApps: {
            discord: { type: Boolean, default: true },
        },
        name: {
            indexable: String,
            display: String,
            closedNameDisplay: String,
            aliases: [String],
        },
        description: String,
        color: String,
        avatar: mediaSchema,
        banner: mediaSchema,
        age: String,
        signoff: String,
        mask: maskSchema,
        discord: entityDiscordSchema,
        caution: {
            c_type: String,
            detail: String,
            triggers: [triggerSchema],
        },
        condition: String,
        proxy: [String],
        metadata: {
            addedAt: { type: Date, default: Date.now },
            convertedFrom: String,
            convertedAt: Date,
            originalId: String,
            importedFrom: String,
            importedAt: Date,
            pluralKitId: String,
            pluralKitUuid: String,
            simplyPluralId: String,
            octoconId: String,
            octoconTagId: String,
            sourceCreatedAt: Date,
            sourceUpdatedAt: Date,
            sourceVisibility: String,
            lastMessageTimestamp: Date,
            messageCount: { type: Number, default: 0 },
            customFields: [{ name: String, value: String }],
            raw: mongoose.Schema.Types.Mixed,
        },
        setting: {
            allowPing: { type: Boolean, default: true },
            default_status: String,
            default_battery: Number,
            mask: {
                maskTo: [{
                    userFriendID: String,
                    discordUserID: String,
                    discordGuildID: String,
                }],
                maskExclude: [{
                    userFriendID: String,
                    discordUserID: String,
                    discordGuildID: String,
                }],
            },
            privacy: [{ bucket: String, settings: mongoose.Schema.Types.Mixed }],
        },
    };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Create an entity schema with shared base fields + entity-specific fields.
 * @param {Object} additionalFields - Entity-specific fields to merge in
 * @param {Object} privacySchema - The privacy sub-schema for this entity type
 * @returns {mongoose.Schema}
 */
function createEntitySchema(additionalFields, privacySchema) {
    const fields = entityFields();

    // Inject the correct privacy schema
    fields.setting.privacy = [{ bucket: String, settings: privacySchema }];

    // Merge entity-specific fields (overrides base if keys collide)
    Object.assign(fields, additionalFields);

    return new mongoose.Schema(fields);
}

/**
 * Apply standard indexes + post-save Redis hook to an entity schema.
 * @param {mongoose.Schema} schema
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @returns {mongoose.Schema}
 */
function applyEntityDefaults(schema, entityType) {
    schema.index({ systemID: 1 });
    schema.index({ systemID: 1, 'name.indexable': 1 });

    // TTL index: auto-delete orphaned entities after5 minutes
    // Only deletes entities where systemID is null (orphans from failed phase 2)
    schema.index({ createdAt: 1 }, {
        expireAfterSeconds: 300, //5 minutes
        partialFilterExpression: { systemID: { $exists: false } }
    });

    schema.post('save', function (doc) {
        try {
            const { publishEvent } = require('../redis');
            const eventType = this.$wasNew ? 'entity:created' : 'entity:edited';
            publishEvent(doc.systemID, {
                type: eventType,
                entityType,
                entityId: doc._id.toString(),
            });
        } catch (_) {}
    });

    return schema;
}

module.exports = {
    maskSchema,
    maskDiscordSchema,
    entityDiscordSchema,
    alterConnectedStateSchema,
    entityFields,
    createEntitySchema,
    applyEntityDefaults,
};
