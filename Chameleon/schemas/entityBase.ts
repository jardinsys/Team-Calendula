/**
 * Entity Base — shared fields, sub-schemas, and helpers for Alter / State / Group.
 *
 * Usage:
 *   const { createEntitySchema, applyEntityDefaults } = require('./entityBase');
 *   const schema = createEntitySchema(additionalFields, privacySchema);
 *   applyEntityDefaults(schema, 'alter');
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { snowflake } from './snowflakeHelper';
import type {
    NameField,
    MediaSchema,
    MaskSettings,
    EntityDiscordSettings,
    CautionSettings,
    EntityMetadata,
    EntitySettings,
    PrivacyEntry,
    AlterConnectedState,
} from '../types';

// ─── Shared sub-schemas ───────────────────────────────────────

const maskDiscordSchema = new Schema({
    name: { display: String, openCharDisplay: String },
    description: String,
    color: String,
    image: {
        avatar: Schema.Types.Mixed,
        banner: Schema.Types.Mixed,
        proxyAvatar: Schema.Types.Mixed,
    },
    pronounSeparator: String,
}, { _id: false });

const maskSchemaDef = new Schema({
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
    },
    description: String,
    color: String,
    avatar: Schema.Types.Mixed,
    discord: maskDiscordSchema,
}, { _id: false });

const entityDiscordSchemaDef = new Schema({
    name: { display: String, openCharDisplay: String },
    description: String,
    color: String,
    image: {
        avatar: Schema.Types.Mixed,
        banner: Schema.Types.Mixed,
        proxyAvatar: Schema.Types.Mixed,
    },
    pronounSeparator: String,
    server: [{
        id: String,
        name: String,
        description: String,
        avatar: Schema.Types.Mixed,
        banner: Schema.Types.Mixed,
        proxyAvatar: Schema.Types.Mixed,
        pronounSeparator: String,
    }],
    metadata: {
        messageCount: { type: Number, integer: true, default: 0 },
        lastMessageTime: Date,
    },
}, { _id: false });

// ─── Entity-specific sub-schemas ──────────────────────────────

const alterConnectedStateSchemaDef = new Schema({
    connected_id: String,
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
    },
    avatar: Schema.Types.Mixed,
    description: String,
    caution: {
        c_type: String,
        detail: String,
        triggers: [Schema.Types.Mixed],
    },
}, { _id: false });

// ─── Shared entity fields (factory — returns fresh object each time) ──

function entityFields(): Record<string, any> {
    return {
        id: {
            type: String,
            default: () => snowflake.generate(),
            unique: true,
        },
        systemID: String,
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
        avatar: Schema.Types.Mixed,
        signoff: String,
        mask: maskSchemaDef,
        discord: entityDiscordSchemaDef,
        caution: {
            c_type: String,
            detail: String,
            triggers: [Schema.Types.Mixed],
        },
        condition: String,
        proxy: [String],
        metadata: {
            addedAt: { type: Date, default: Date.now },
            convertedFrom: String,
            convertedAt: Date,
            originalId: String,
            importedFrom: String,
            pluralKitId: String,
            pluralKitUuid: String,
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
            privacy: [{ bucket: String, settings: Schema.Types.Mixed }],
        },
    };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Create an entity schema with shared base fields + entity-specific fields.
 * @param additionalFields - Entity-specific fields to merge in
 * @param privacySchema - The privacy sub-schema for this entity type
 * @returns Mongoose Schema
 */
function createEntitySchema(
    additionalFields: Record<string, any>,
    privacySchema: Schema
): Schema {
    const fields = entityFields();

    // Inject the correct privacy schema
    fields.setting.privacy = [{ bucket: String, settings: privacySchema }];

    // Merge entity-specific fields (overrides base if keys collide)
    Object.assign(fields, additionalFields);

    return new Schema(fields);
}

/**
 * Apply standard indexes + post-save Redis hook to an entity schema.
 * @param schema - The Mongoose schema to enhance
 * @param entityType - 'alter', 'state', or 'group'
 * @returns The same schema (for chaining)
 */
function applyEntityDefaults(
    schema: Schema,
    entityType: 'alter' | 'state' | 'group'
): Schema {
    schema.index({ systemID: 1 });
    schema.index({ systemID: 1, 'name.indexable': 1 });

    schema.post('save', function (this: any, doc: any) {
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

export {
    maskSchemaDef as maskSchema,
    maskDiscordSchema,
    entityDiscordSchemaDef as entityDiscordSchema,
    alterConnectedStateSchemaDef as alterConnectedStateSchema,
    entityFields,
    createEntitySchema,
    applyEntityDefaults,
};

// CommonJS compatibility
module.exports = {
    maskSchema: maskSchemaDef,
    maskDiscordSchema,
    entityDiscordSchema: entityDiscordSchemaDef,
    alterConnectedStateSchema: alterConnectedStateSchemaDef,
    entityFields,
    createEntitySchema,
    applyEntityDefaults,
};
