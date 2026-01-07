const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require('../../media.js');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

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
    pinned: Boolean,
    title: String,
    content: mediaSchema,
    contentPreview: String,
    media: [{
        media: mediaSchema,
        position: { type: Number, required: true, integer: true },
        caption: String,
        placeholder: String
    }],
    color: String
}, {
    timestamps: true
});
const Note = sysDB.model('Note', noteSchema);
module.exports = Note;