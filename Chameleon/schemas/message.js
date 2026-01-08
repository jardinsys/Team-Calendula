const mongoose = require("mongoose");
const sysDB = require("../database");

const messageSchema = new mongoose.Schema({
    discord_webhook_id: { type: String, unique: true },
    discord_webhook_message_id: String,
    discord_user_id: String,
    discord_guild_id: String,
    id: String,
    proxy_type: { type: String, enum: ['alter', 'state', 'group'] },
    proxy_id: String
});

const Message = sysDB.model('Message', messageSchema);
module.exports = Message;