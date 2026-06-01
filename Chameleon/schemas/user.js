const mongoose = require("mongoose");
const sysDB = require("../database");
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const userSchema = new mongoose.Schema({
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
    systemID: String,
    pronouns: [String],
    pronounSeperator: String,

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
        friendID: String,
        customName: {
            indexable: String,
            display: String
        },
        discordID: { type: String, index: true },
        addedAt: { type: Date },
        privacyBucket: String
    }],
    friendRequests: [{
        fromDiscordID: String,
        fromFriendID: String,
        fromName: String,
        fromSystemName: String,
        sentAt: { type: Date, default: Date.now }
    }],
    blocked: [{
        name: {
            indexable: String,
            display: String
        },
        discordID: { type: String, index: true },
        friendID: { type: String, index: true },
        addedAt: { type: Date }
    }],
    settings:{
        closedCharAllowed: {type: Boolean, default: true},
        allowPing: {type: Boolean, default: true},
        notificationPreferences: {
            friendNotifications: { type: String, enum: ['none', 'dm', 'command'], default: 'dm' },
            friendRequests: { type: Boolean, default: true },
            appMessages: { type: Boolean, default: true },
            friendSwitches: { type: Boolean, default: true }
        }
    }

});

const User = sysDB.model('User', userSchema);
module.exports = User;