const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require("../../media");
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
    system: { type: String, ref: 'System' },
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
    groups: [{ type: String, ref: 'Group' }],
    mask: {
        maskTo: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            discordUserID: String,
            discordGuildID: { type: String, ref: 'Guild' }
        }],
        maskExclude: [{
            user: 'User',
            discordUserID: String,
            discordGuildID: { type: String, ref: 'Guild' }
        }],
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
            id: { type: String, ref: 'Guild' },
            name: String,
            description: String,
            avatar: mediaSchema,
            pronounSeparator: String,
        }],
        metadata: {
            messageCount: Number,
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
        privacy: [{}]
    }
});

const Alter = sysDB.model('Alter', alterSchema);
module.exports = Alter;