const mongoose = require("mongoose");
const sysDB = require("../database");
const friendPrivacySettingsSchema = require('./settings');
const mediaSchema = require('../../media.js');
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const systemSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}],

    name: String,
    type: String,
    discord: {
        name: {},
        description: String,
    },
    app: {},
    proxy: {},
    setting: {}
});

const System = sysDB.model('System', systemSchema);
module.exports = System;