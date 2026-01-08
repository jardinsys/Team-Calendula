const mongoose = require('mongoose');
const config = require('./../config.json');

const mongoURI = config.mongoURIs.sucre;

const sucreDB = mongoose.createConnection(mongoURI);

sucreDB.on('connected', () => {
    console.log(`Sugar's Mongoose connected to MongoDB`);
});

sucreDB.on('error', (err) => {
    console.error(`Sugar's Mongoose connection error:`, err);
});

sucreDB.on('disconnected', () => {
    console.log(`Sugar's Mongoose disconnected from MongoDB`);
});

module.exports = sucreDB;