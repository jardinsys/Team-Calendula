const mongoose = require("mongoose");
const sysDB = require("../database");

const guildSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    userIDs: [String],

    // Server admins who can configure Systemiser
    admins: {
        roleIDs: [String],
        memberIDs: [String]
    },

    // Channel-level controls
    channels: {
        // Channels where proxying is disabled
        blacklist: [String],
        // If set, ONLY these channels allow proxying (overrides blacklist)
        whitelist: [String],
        // Channel where proxy events are logged
        logChannel: String,
        // What to log
        logEvents: {
            proxy: { type: Boolean, default: true },      // Log when messages are proxied
            edit: { type: Boolean, default: false },      // Log when proxied messages are edited
            delete: { type: Boolean, default: false }     // Log when proxied messages are deleted
        }
    },

    // Server-wide settings
    settings: {
        // Allow special/closed characters in names
        closedCharAllowed: { type: Boolean, default: true },
        // Master switch for proxying (false = no proxying at all)
        allowProxy: { type: Boolean, default: true },
        // Force disable autoproxy for all users in this server
        // Users must use proxy tags, no automatic proxying
        forceDisableAutoproxy: { type: Boolean, default: false }
    }
});

const Guild = sysDB.model('Guild', guildSchema);
module.exports = Guild;