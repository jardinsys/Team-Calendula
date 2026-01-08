const mongoose = require("mongoose");
const sucreDB = require("../database");

const affirmationSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: String,
    text: String,
    footer: String,
});

const Affirmation = sucreDB.model('Affirmation', affirmationSchema);
module.exports = Affirmation;