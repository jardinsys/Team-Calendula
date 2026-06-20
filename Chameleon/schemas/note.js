const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require('../../media.js');
const { snowflake } = require('./snowflakeHelper');

const noteSchema = new mongoose.Schema({
    id: { type: String, default: () => snowflake.generate(), unique: true },
    author: {
        userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        subs: [{
            ID: String,
            s_type: { type: String, enum: ["alter", "state", "group"] }
        }]
    },
    users: {
        owner: {
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            subs: [{
                ID: String,
                s_type: { type: String, enum: ["alter", "state", "group"] }
            }]
        },
        rwAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            subs: [{
                ID: String,
                s_type: { type: String, enum: ["alter", "state", "group"] }
            }]
        }],
        rAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }]
    },
    tags: [String],
    pinned: { type: Boolean, default: false },
    title: String,
    content: mediaSchema,
    contentPreview: String,
    media: [{
        media: mediaSchema,
        position: { type: Number, required: true, integer: true },
        caption: String,
        placeholder: String
    }],
    color: String,
    entityOwner: {
        type: { type: String, enum: ['alter', 'state', 'group'] },
        ID: String
    },
    attribution: [{
        entities: [{
            entity: {
                type: { type: String, enum: ['alter', 'group', 'user'] },
                ID: String
            },
            entityStates: { priorityID: String, allIDs: [String] }
        }],
        userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        action: { type: String, enum: ['create', 'edit', 'append'] }
    }]
}, {
    timestamps: true
});
const Note = sysDB.model('Note', noteSchema);
module.exports = Note;