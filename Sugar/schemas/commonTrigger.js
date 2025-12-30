const mongoose = require("mongoose");
const sucreDB = require("../database");

const commonTriggerSchema = new mongoose.Schema({
    name: String,
    description: String,
    help: String
});

const CommonTrigger = sucreDB.model('CommonTrigger', commonTriggerSchema);
module.exports = CommonTrigger;