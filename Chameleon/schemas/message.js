const mongoose = require("mongoose");
const sysDB = require("../database");

const messageSchema = new mongoose.Schema({
    discord_webhook_id: { type: String },
    discord_webhook_message_id: { type: String, unique: true },
    discord_channel_id: String,
    discord_guild_id: String,
    original_message_id: String,
    discord_user_id: String,
    system_id: String,
    proxy_type: { type: String, enum: ['alter', 'state', 'group'] },
    proxy_id: String,
    proxy_matched: String,
    content: String,
    attachments: [{
        url: String,
        name: String,
        size: Number
    }]
}, { timestamps: true });

messageSchema.index({ discord_user_id: 1, discord_channel_id: 1 });

const Message = sysDB.model('Message', messageSchema);
module.exports = Message;
