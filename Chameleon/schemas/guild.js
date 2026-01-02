const mongoose = require("mongoose");
const sysDB = require("../database");

const guildSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    userIDs: [String],
    admins: {
        roleIDs: [String],
        memberIDs: [String] 
    },
    settings: {
        closedCharAllowed: {type: Boolean, default: true},
        allowProxy: {type: Boolean, default: true}
    }
});

const Guild = sysDB.model('Guild', guildSchema);
module.exports = Guild;