const mongoose = require("mongoose");
const sysDB = require("../database");
const { PrivacyBucket, systemPrivacySchema } = require('./settings');
const { layerSchema } = require('./front.js');
const triggerSchema = require('../../TigerLily/schemas/trigger.js');
const mediaSchema = require('../../media.js');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const systemSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    metadata: {
        joinedAt: { type: Date, default: Date.now },
    },

    syncWithApps: {
        discord: Boolean
    },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String
    },
    sys_type: {
        name: {type: String, default: "None"},
        dd:{
            DSM:{type: String, enum: ["DID","Amnesia","Dereal/Depers","OSDD-1A","OSDD-1B","OSDD-2","OSDD-3","OSDD-4","UDD"]},
            ICD: {type: String, enum: ["P-DID","Trance","DNSD","Possession Trance","SDS"]},
        },
        calledSystem: Boolean
    },
    description: String,
    birthday: Date,
    timezone: String,
    color: String,
    theme: {
        background: {
            media: mediaSchema, // $$
            colorTheme: {
                colors: [String],
            }
        },
    },
    avatar: mediaSchema,
    alterSynonym: {
        singular: { type: String, default: "alter" },
        plural: { type: String, default: "alters" }
    },
    alters: {
        conditions: [{
            name: String,
            settings: {
                hide_to_self: Boolean,
                include_in_Count: Boolean,
            }
        }],
        IDs: [String]
    },
    states: {
        conditions: [{
            name: String,
            settings: {
                hide_to_self: Boolean,
                include_in_Count: Boolean,
            }
        }],
        IDs: [String]
    },
    groups: {
        types: [String],
        conditions: [{
            name: String,
            settings: {
                hide_to_self: Boolean,
                include_in_Count: Boolean,
            },
        }],
        IDs: [String]
    },
    mask: {
        name: {
            indexable: String,
            display: String,
            closedNameDisplay: String
        },
        pronouns: String,
        description: String,
        color: String,
        avatar: mediaSchema,
        theme: {
            background: {
                media: mediaSchema, // $$
                colorTheme: {
                    colors: [String],
                }
            },
        },
        discord: {
            name: {
                display: String,
                openCharDisplay: String
            },
            description: String,
            color: String,
            image: {
                avatar: mediaSchema,
                banner: mediaSchema,
            },
            tag: {
                normal: [String],
                openCharDisplay: [String]
            },
            pronounSeparator: String
        }
    },
    discord: {
        name: {
            display: String,
            openCharDisplay: String
        },
        description: String,
        color: String,
        image: {
            avatar: mediaSchema,
            banner: mediaSchema,
        },
        tag: {
            normal: [String],
            openCharDisplay: [String]
        },
        pronounSeparator: String,
        proxylayout: String,
        server: [{
            id: String,
            name: String,
            description: String,
            avatar: mediaSchema,
            tag: [String],
            pronounSeparator: String,
            proxyStyle: { type: String, default: off }
        }]
    },
    front: {
        status: String,
        caution: String,
        layers: [layerSchema],
    },
    battery: Number, // Social Battery
    caution: {
        c_type: String,
        detail: String,
        default: {
            c_type: String,
            detail: String,
        },
        cautionAlgos: [{
            style: String,
            alters: [String],
            layer: [String],
            c_type: String,
            detail: String,
        }],
        triggers: [triggerSchema],
    },
    proxy: {
        layout: String,
        recentProxies: [String],
        lastProxyTime: Date,
        break: Boolean,
        style: { type: String, default: off }
    },
    setting: {
        autoshareNotestoUsers: { type: Boolean, default: false },
        proxyCoolDown: { type: Number, default: 3600 },
        mask: {
            maskTo: [{
                userFriendID: String,
                discordUserID: String,
                discordGuildID: String
            }],
            maskExclude: [{
                userFriendID: String,
                discordUserID: String,
                discordGuildID: String
            }]
        },
        privacy: [{
            bucket: String,
            settings: systemPrivacySchema
        }],
        friendAutoBucket: String
    },
    privacyBuckets: [PrivacyBucket],
    affirmations: [String]
});

const System = sysDB.model('System', systemSchema);
module.exports = System;