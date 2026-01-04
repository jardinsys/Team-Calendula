const mongoose = require("mongoose");
const sysDB = require("../database");

const messageSchema = new mongoose.Schema({
    discord_webhook_id: { type: String, unique: true },
    id: String,
    proxy_type: {type: String, enum: [alter, state, group]}
});

const Message = sysDB.model('Message', messageSchema);
module.exports = Message;