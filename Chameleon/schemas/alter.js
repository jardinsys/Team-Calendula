const mongoose = require("mongoose");
const sysDB = require("../database");

const alterSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    username: String,
    createdAt: { type: Date, default: Date.now }
});

const Alter = sysDB.model('Alter', alterSchema);

module.exports = Alter;