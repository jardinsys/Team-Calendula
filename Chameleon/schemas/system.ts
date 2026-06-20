/**
 * System schema — the root document representing a dissociative system.
 *
 * This is the most complex schema, containing:
 * - User associations
 * - Entity registries (alters, states, groups)
 * - Mask mode configuration
 * - Discord integration settings
 * - Front tracking
 * - Caution/trigger management
 * - Proxy settings
 * - Privacy buckets
 */

import mongoose, { Schema } from 'mongoose';
import sysDB from '../database';
import { PrivacyBucket, systemPrivacySchema, alterPrivacySchema, groupPrivacySchema } from './settings';
import { layerSchema } from './front';
import { maskSchema, maskDiscordSchema, entityDiscordSchema } from './entityBase';
import { snowflake } from './snowflakeHelper';

// ─── External schemas ────────────────────────────────────────
// These exist outside the Chameleon folder in the Team-Calendula repo
const triggerSchema = require('../../TigerLily/schemas/trigger.js').triggerSchema;
const mediaSchema = require('../../media.js');

// ─── System Schema ───────────────────────────────────────────

const systemSchema = new Schema({
    id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true,
    },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    metadata: {
        joinedAt: { type: Date, default: Date.now },
    },
    syncWithApps: {
        discord: { type: Boolean, default: true },
    },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
    },
    sys_type: {
        name: String,
        dd: {
            DSM: { type: String, enum: ["DID", "Amnesia", "Amnesia-Fugue", "Dereal/Depers", "OSDD-1A", "OSDD-1B", "OSDD-2", "OSDD-3", "OSDD-4", "UDD"] },
            ICD: { type: String, enum: ["P-DID", "Amnesia", "Amnesia-Fugue", "Trance", "DNSD", "Possession Trance", "Depersonalization-Derealization"] },
        },
        isSystem: { type: Boolean, default: false },
        isFragmented: { type: Boolean, default: false },
        isDissociative: { type: Boolean, default: false },
        dissociativeStateName: { type: String, default: 'Dissociated' },
        onboardingCompleted: { type: Boolean, default: false },
    },
    description: String,
    birthday: Date,
    timezone: String,
    color: String,

    // ─── Theming ───────────────────────────────────────
    theme: {
        background: {
            media: mediaSchema,
            colorTheme: { colors: [String] },
        },
    },
    avatar: mediaSchema,
    alterSynonym: {
        singular: { type: String, default: "alter" },
        plural: { type: String, default: "alters" },
    },
    systemSynonym: { type: String, default: "system" },

    // ─── Entity registries ─────────────────────────────
    alters: {
        conditions: [{ name: String, settings: { hide_to_self: Boolean, include_in_Count: Boolean } }],
        IDs: [String],
    },
    states: {
        conditions: [{ name: String, settings: { hide_to_self: Boolean, include_in_Count: Boolean } }],
        IDs: [String],
    },
    groups: {
        types: [String],
        conditions: [{ name: String, settings: { hide_to_self: Boolean, include_in_Count: Boolean } }],
        IDs: [String],
    },

    // ─── Mask mode (extends shared maskSchema) ─────────
    mask: {
        name: maskSchema.obj.name,
        description: maskSchema.obj.description,
        color: maskSchema.obj.color,
        avatar: maskSchema.obj.avatar,
        pronouns: String,
        theme: {
            background: {
                media: mediaSchema,
                colorTheme: { colors: [String] },
            },
        },
        discord: {
            name: maskDiscordSchema.obj.name,
            description: maskDiscordSchema.obj.description,
            color: maskDiscordSchema.obj.color,
            image: maskDiscordSchema.obj.image,
            pronounSeparator: maskDiscordSchema.obj.pronounSeparator,
            tag: {
                normal: [String],
                openCharDisplay: [String],
            },
        },
    },

    // ─── Discord integration (extends shared entityDiscordSchema) ──
    discord: {
        name: entityDiscordSchema.obj.name,
        description: entityDiscordSchema.obj.description,
        color: entityDiscordSchema.obj.color,
        image: entityDiscordSchema.obj.image,
        pronounSeparator: entityDiscordSchema.obj.pronounSeparator,
        tag: {
            normal: [String],
            openCharDisplay: [String],
        },
        proxylayout: {
            alter: String,
            state: String,
            group: String,
        },
        server: [{
            id: String,
            name: String,
            description: String,
            avatar: Schema.Types.Mixed,
            banner: Schema.Types.Mixed,
            proxyAvatar: Schema.Types.Mixed,
            pronounSeparator: String,
            tag: [String],
            proxyStyle: { type: String, default: "off" },
            replyStyle: String,
        }],
        metadata: entityDiscordSchema.obj.metadata,
    },

    // ─── Front ─────────────────────────────────────────
    front: {
        status: String,
        caution: String,
        layers: [layerSchema],
    },

    // ─── Caution ───────────────────────────────────────
    battery: Number,
    caution: {
        c_type: String,
        detail: String,
        default: { c_type: String, detail: String },
        cautionAlgos: [{
            style: String,
            alters: [String],
            layer: [String],
            c_type: String,
            detail: String,
        }],
        triggers: [triggerSchema],
    },

    // ─── Proxy ─────────────────────────────────────────
    proxy: {
        layout: String,
        recentProxies: [String],
        lastProxyTime: Date,
        break: Boolean,
        style: { type: String, default: "off" },
        caseSensitive: Boolean,
        replyStyle: { type: String, default: "embed" },
    },

    // ─── Settings & Privacy ────────────────────────────
    setting: {
        autoshareNotestoUsers: { type: Boolean, default: false },
        proxyCoolDown: { type: Number, default: 3600 },
        noteAutoAttribution: { type: String, enum: ['topLayer', 'allFronters', 'off'], default: 'topLayer' },
        mask: {
            maskTo: [{ userFriendID: String, discordUserID: String, discordGuildID: String }],
            maskExclude: [{ userFriendID: String, discordUserID: String, discordGuildID: String }],
        },
        privacy: [{
            bucket: String,
            settings: systemPrivacySchema,
            defaults: {
                alter: alterPrivacySchema,
                state: alterPrivacySchema,
                group: groupPrivacySchema,
            },
        }],
        friendAutoBucket: String,
    },
    privacyBuckets: [{ type: Schema.Types.ObjectId, ref: 'PrivacyBucket' }],
    affirmations: [String],
});

// ─── Post-save hook ──────────────────────────────────────────
systemSchema.post('save', function (this: any, doc: any) {
    try {
        const { publishEvent } = require('../redis');
        const eventType = this.$wasNew ? 'system:created' : 'system:updated';
        publishEvent(doc._id?.toString(), { type: eventType });
    } catch (_) {}
});

// ─── Create Model (using `any` for gradual migration) ────────
const System: any = sysDB.model('System', systemSchema);

export default System;

// CommonJS compatibility
module.exports = System;
