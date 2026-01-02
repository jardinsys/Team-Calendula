const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require("../../media");
const { alterPrivacySchema } = require("./settings");
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const alterSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    systemID: String,
    addedAt: { type: Date, default: Date.now },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String
    },
    aliases: [{
        indexable: String,
        display: String,
        closedNameDisplay: String
    }],
    type: String,
    description: String,
    birthday: Date,
    color: String,
    avatar: mediaSchema,
    groupsIDs: [String],
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
            messageCount: { type: Number, integer: true },
            lastMessageTime: Date,
        }
    },
    caution: {
        c_type: String,
        detail: String,
    },
    condition: {
        name: String,
        settings: {
            hide_to_self: Boolean,
            include_in_Count: Boolean,
        }
    },
    proxy: [String],
    metadata: {
        createdAt: { type: Date, default: Date.now },
    },
    setting: {
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

const Alter = sysDB.model('Alter', alterSchema);
module.exports = Alter;