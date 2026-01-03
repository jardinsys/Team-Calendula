const mongoose = require("mongoose");
const trigDB = require("../database");
const mediaSchema = require('../../media.js');
const { triggerGroupSchema } = require('./trigger');

const userSchema = new mongoose.Schema({
    //User Info
    _id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    discordId: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now },
    pronouns: String,

    //Intro
    intro: {
        thumbnail: mediaSchema,
        color: String,
        text: String,
        title: String, // $$
        footer: { // $$
            text: String, // $$
            icon: mediaSchema // $$
        },
        header: { // $$
            text: String, // $$
            icon: mediaSchema // $$
        },
        field: { // $$
            title: [String], // $$
            text: [String] // $$
        },
        banner: mediaSchema // $$
    },

    //Trigger
    trigger: {
        thumbnail: mediaSchema,
        color: String,
        bullet: { type: String, default: '-'},
        triggerGroups: [triggerGroupSchema],
        title: String, // $$
        footer: { // $$
            text: String, // $$
            icon: mediaSchema // $$
        },
        header: { // $$
            text: String, // $$
            icon: mediaSchema // $$
        },
        banner: mediaSchema // $$
    },

    //Affirmations
    affirmations: [String],

    //Premium
    premium: {
        active: Boolean,
        startDate: Date,
        expireDate: Date
    },
    sponsor: {
        available: Number,
        guildIDs: [String],
        userIDs: [String]
    }
});

const User = trigDB.model('User', userSchema);
module.exports = User;