const mongoose = require("mongoose");
const sysDB = require("../database");
const friendPrivacySettingsSchema = require('./settings');
const mediaSchema = require('../../media.js');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const userSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    discordID: { type: String, unique: true },
    joinedAt: { type: Date, default: Date.now },
    connection: {
        email: String,
        discord: String,
        google: String,
        apple: String
    },
    friendID: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    systemID: { type: String, index: true, ref: 'System' },
    pronouns: String,

    discord: {
        name: {
            indexable: String,
            display: String
        },
        description: String
    },
    app: {
        name: {
            indexable: String,
            display: String
        },
        description: String
    },

    notes: {
        tags: [String],
        notes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }]
    },

    friends: [{
        friendID: { type: String, index: true, ref: 'User' },
        name: {
            indexable: String,
            display: String
        },
        discordID: { type: String, index: true },
        addedAt: { type: Date, default: Date.now },
        privacySettings: friendPrivacySettingsSchema
    }],
    blocked: [{
        name: {
            indexable: String,
            display: String
        },
        discordID: { type: String, index: true },
        friendID: { type: String, index: true },
        addedAt: { type: Date, default: Date.now }
    }]

});

const User = sysDB.model('User', userSchema);
module.exports = User;