const mongoose = require("mongoose");
const sysDB = require("../database");
const {PrivacyBucket, systemPrivacySchema} = require('./settings');
const { layerSchema } = require('./front.js')
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

    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String
    },
    sys_type: {
        name: String,
        calledSysstem: Boolean
    },
    description: String,
    birthday: Date,
    color: String,
    avatar: mediaSchema,
    alterSynonym: {
        singular: { type: String, default: "alter" },
        plural: { type: String, default: "alters" }
    },
    alterIDs: [String],
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
            proxylayout: String,
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
    cautionAlgos: [{
        style: String,
        alters: [String],
        layer: [String]
    }],
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