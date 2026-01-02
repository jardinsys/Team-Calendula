const mongoose = require("mongoose");
const sysDB = require("../database");

//System
const systemPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    birthday: Boolean,
    pronouns: Boolean,
    metadata: Boolean,
    hidden: Boolean
});

//Group
const groupPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    list: Boolean,
    metadata: Boolean,
    hidden: Boolean,
});

//Alter
const alterPrivacySchema = new mongoose.Schema({
    mask: Boolean,
    description: Boolean,
    banner: Boolean,
    avatar: Boolean,
    birthday: Boolean,
    pronouns: Boolean,
    metadata: Boolean,
    hidden: Boolean,
    proxies: Boolean,
    aliases: {
        all: Boolean,
        allowed: [String]
    }
});

//Privacy Bucket
const privacyBucketSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    friends: [{
        friendID: String,
        discordUserID: String,
        discordGuildID: String,
    }]
});

const PrivacyBucket = sysDB.model('PrivacyBucket', privacyBucketSchema);

module.exports = {
    systemPrivacySchema,
    groupPrivacySchema,
    alterPrivacySchema,
    PrivacyBucket
};


