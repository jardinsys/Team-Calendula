const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require("../../media");
const { groupPrivacySchema } = require("./settings");
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const groupSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    systemID: String,
    createdAt: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String
    },
    type: String,
    description: String,
    color: String,
    avatar: mediaSchema,
    alterIDs: [String],
    stateIDs: [String],
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
                banner: mediaSchema
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
            banner: mediaSchema
        },
        pronounSeparator: String,
        server: [{
            id: String,
            name: String,
            description: String,
            avatar: mediaSchema,
            pronounSeparator: String,
        }]
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
            settings: groupPrivacySchema
        }]
    }
});

const Group = sysDB.model('Group', groupSchema);
module.exports = Group;