const mongoose = require("mongoose");
const sysDB = require("../database");
const { PrivacyBucket, systemPrivacySchema, alterPrivacySchema, groupPrivacySchema } = require('./settings');
const { layerSchema } = require('./front.js');
const triggerSchema = require('../../TigerLily/schemas/trigger.js');
const mediaSchema = require('../../media.js');
const { maskSchema, maskDiscordSchema, entityDiscordSchema } = require('./entityBase');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({ mid: 1, offset: 0 });

const systemSchema = new mongoose.Schema({
    id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true,
    },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
        ...maskSchema,
        pronouns: String,
        theme: {
            background: {
                media: mediaSchema,
                colorTheme: { colors: [String] },
            },
        },
        discord: {
            ...maskDiscordSchema,
            tag: {
                normal: [String],
                openCharDisplay: [String],
            },
        },
    },

    // ─── Discord integration (extends shared entityDiscordSchema) ──
    discord: {
        ...entityDiscordSchema,
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
            ...entityDiscordSchema.server[0],
            tag: [String],
            proxyStyle: { type: String, default: "off" },
            replyStyle: String,
        }],
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
    privacyBuckets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PrivacyBucket' }],
    affirmations: [String],
});

systemSchema.post('save', function (doc) {
    try {
        const { publishEvent } = require('../redis');
        const eventType = this.$wasNew ? 'system:created' : 'system:updated';
        publishEvent(doc._id?.toString(), { type: eventType });
    } catch (_) {}
});

const System = sysDB.model('System', systemSchema);
module.exports = System;
