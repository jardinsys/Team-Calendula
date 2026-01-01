const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require('../../media.js');

const noteSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    author: {
        userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        alters: [{ author: { type: String, ref: 'Alter' } }],
        state: [{ author: { type: String, ref: 'State' } }],
        group: [{ author: { type: String, ref: 'Group' } }]
    },
    users: {
        owner: {
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alters: [{ author: { type: String, ref: 'Alter' } }],
            state: [{ author: { type: String, ref: 'State' } }],
            group: [{ author: { type: String, ref: 'Group' } }]
        },
        rwAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alters: [{ author: { type: String, ref: 'Alter' } }],
            state: [{ author: { type: String, ref: 'State' } }],
            group: [{ author: { type: String, ref: 'Group' } }]
        }],
        rAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alters: [{ author: { type: String, ref: 'Alter' } }],
            state: [{ author: { type: String, ref: 'State' } }],
            group: [{ author: { type: String, ref: 'Group' } }]
        }],
    },
    tags: [String],
    title: String,
    content: String,
    media: [{
        mediaID: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
        position: { type: Number, required: true, integer: true},
        caption: String,
        placeholder: String
    }]
},{
    timestamps: true
});
const Note = sysDB.model('Note', noteSchema);
module.exports = Note;