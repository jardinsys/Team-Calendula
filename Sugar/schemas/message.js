const mongoose = require("mongoose");
const sucreDB = require("../database");
const mediaSchema = require("../../media");
const Snowflake = require('snowflake-id').default;
const snowflake = new Snowflake({
    mid: 1,  // Machine ID
    offset: 0
});

const messageSchema = new mongoose.Schema({
    // Message Info
    _id: {
        type: String,
        default: () => snowflake.generate(),
        unique: true
    },
    app: {
        type: String,
        enum: ['trig', 'sys'],
        required: true
    },
    recieverType: {
        type: String,
        enum: ['user', 'guild'],
        required: true
    },
    createdAt: {type:Date, default: Date.now},

    // Content
    title: String,
    text: String,
    thumbnail: mediaSchema,
    banner: mediaSchema,
    color: String,
    footer: {
        text: String,
        icon: mediaSchema
    },
    header: {
        text: String,
        icon: mediaSchema
    },
    field: {
        title: [String],
        text: [String]
    },
});

const Message = sucreDB.model('Message', messageSchema);
module.exports = Message;