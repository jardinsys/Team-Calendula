const mongoose = require("mongoose");
const sucreDB = require("../database");

const areaSchema = new mongoose.Schema({
    name: String,
    hotlines: [{
        name: String,
        contacts: {
            links: String,
            phone: String,
        }
    }],
     
});

const hotlineSchema = new mongoose.Schema({
    country: {type: String, unique: true},
    aliases: [String],
    hotlines: [{
        name: String,
        contacts: {
            links: String,
            phone: String,
        }
    }],
    areas: {
        type_name: String, // State/Province
        area: [areaSchema]
    }

});

const Hotline = sucreDB.model('Hotline', hotlineSchema);
module.exports = Hotline;