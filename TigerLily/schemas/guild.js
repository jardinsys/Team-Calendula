const mongoose = require("mongoose");
const trigDB = require("../database");
const { triggerGroupSchema } = require('./trigger');

const guildSchema = new mongoose.Schema({
    //Guild Info
    discordId: { type: String, required: true, unique: true },
    admins: {
        roleIDs: [String],
        memberIDs: [String] 
    },

    userIDs: [String], // $$
    webhooksEnabled: Boolean, // $$
    userTriggerChannel: String,
    userIntroChannel: String,
    serverIntroMessageURL: String,
    serverTriggerMessageURL: String,   

    //Intro
    intro: {
        mainMessageID: String,
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
        mainMessageID: String,
        thumbnail: mediaSchema,
        color: String,
        bullet: String,
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
        sponsorCount: Number,
        startDate: Date,
        expireDate: Date
    }
});

const Guild = trigDB.model('Guild', guildSchema);
module.exports = Guild;