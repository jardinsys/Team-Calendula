const mongoose = require("mongoose");
const sysDB = require("../database");

//Guild
//System
//Group
//Alter
const alterPrivacySchema = new mongoose.Schema({
    
});

//Privacy Bucket
const privacyBucketSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    name: String,
    friends: {
        user: [{ type: String, ref: 'User' }],
        discordID: String
    }
});

const PrivacyBucket = sysDB.model('PrivacyBucket', privacyBucketSchema);


