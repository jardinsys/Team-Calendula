const mongoose = require("mongoose");
const sysDB = require("../database");
const mediaSchema = require('../../media.js');

const noteSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    author: {
        userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        alterIDs: [String],
        stateIDs: [String],
        groupIDs: [String]
    },
    users: {
        owner: {
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alterIDs: [String],
            stateIDs: [String],
            groupIDs: [String]
        },
        rwAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alterIDs: [String],
            stateIDs: [String],
            groupIDs: [String]
        }],
        rAccess: [{
            userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            alterIDs: [String],
            stateIDs: [String],
            groupIDs: [String]
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