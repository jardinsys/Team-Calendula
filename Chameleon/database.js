const mongoose = require('mongoose');
const config = require('./../config.json');

const mongoURI = config.mongoURIs.system;

const sysDB = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

sysDB.on('connected', () => {
    console.log(`Systemiser's Mongoose connected to MongoDB`);
});

sysDB.on('error', (err) => {
    console.error(`Systemiser's Mongoose connection error:`, err);
});

sysDB.on('disconnected', () => {
    console.log(`Systemiser's Mongoose disconnected from MongoDB`);
});

module.exports = sysDB;