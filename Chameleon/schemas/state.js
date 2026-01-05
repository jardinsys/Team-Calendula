const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require("../../media");
const triggerSchema = require('../../TigerLily/schemas/trigger.js');
const { alterPrivacySchema } = require("./settings");
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const stateSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    systemID: String,
    genesisDate: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now },
    syncWithApps: {
        discord: Boolean
    },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
        aliases: [String],
    },
    alters: [String],
    description: String,
    color: String,
    avatar: mediaSchema,
    signoff: String,
    groupIDs: [String],
    mask: {
        name: {
            indexable: String,
            display: String,
            closedNameDisplay: String
        },
        description: String,
        color: String,
        avatar: mediaSchema,
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
                proxyAvatar: mediaSchema
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
            proxyAvatar: mediaSchema
        },
        pronounSeparator: String,
        server: [{
            id: String,
            name: String,
            description: String,
            avatar: mediaSchema,
            pronounSeparator: String,
        }],
        metadata: {
            messageCount: { type: Number, integer: true, default: 0 },
            lastMessageTime: Date,
        }
    },
    caution: {
        c_type: String,
        detail: String,
        triggers: [triggerSchema],
    },
    condition: String,
    proxy: [String],
    setting: {
        default_status: String,
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
            }],
        },
        privacy: [{
            bucket: String,
            settings: alterPrivacySchema
        }]
    }
});

const State = sysDB.model('State', stateSchema);
module.exports = State;