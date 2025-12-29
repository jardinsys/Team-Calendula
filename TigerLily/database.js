const mongoose = require('mongoose');
const config = require('./../config.json');

const mongoURI = config.mongoURIs.trigin;

const trigDB = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

trigDB.on('connected', () => {
    console.log(`Trigin's Mongoose connected to MongoDB`);
});

trigDB.on('error', (err) => {
    console.error(`Trigin's Mongoose connection error:`, err);
});

trigDB.on('disconnected', () => {
    console.log(`Trigin's Mongoose disconnected from MongoDB`);
});

module.exports = trigDB;