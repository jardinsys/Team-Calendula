const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require("../../media");
const { alterPrivacySchema } = require("./settings");
const triggerSchema = require('../../TigerLily/schemas/trigger.js');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const alterSchema = new mongoose.Schema({
    id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    systemID: String,
        genesisDate: Date,
    syncWithApps: {
        discord: { type: Boolean, default: true }
    },
    name: {
        indexable: String,
        display: String,
        closedNameDisplay: String,
        aliases: [String]
    },
    pronouns: [String],
    states: [{
        connected_id: String,
        name: {
            indexable: String,
            display: String,
            closedNameDisplay: String
        },
        avatar: mediaSchema,
        description: String,
        caution: {
            c_type: String,
            detail: String,
            triggers: [triggerSchema]
        }
    }],
    description: String,
    birthday: Date,
    color: String,
    avatar: mediaSchema,
    signoff: String,
    groupsIDs: [String],
    activeStates: {
        priority: String,
        all: [String]
    },
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
            banner: mediaSchema,
            proxyAvatar: mediaSchema,
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
        triggers: [triggerSchema]
    },
    condition: String,
    proxy: [String],
    metadata: {
        addedAt: { type: Date, default: Date.now },
        convertedFrom: String,
        convertedAt: Date,
        originalId: String,
        importedFrom: String,
        pluralKitId: String,
        pluralKitUuid: String,
    },
    setting: {
        allowPing: { type: Boolean, default: true },
        default_status: String,
        default_battery: Number,
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

alterSchema.index({ systemID: 1 });
alterSchema.index({ systemID: 1, 'name.indexable': 1 });

alterSchema.post('save', function (doc) {
    try {
        const { publishEvent } = require('../redis');
        const eventType = this.$wasNew ? 'entity:created' : 'entity:edited';
        publishEvent(doc.systemID, { type: eventType, entityType: 'alter', entityId: doc._id.toString() });
    } catch (_) {}
});

const Alter = sysDB.model('Alter', alterSchema);
module.exports = Alter;