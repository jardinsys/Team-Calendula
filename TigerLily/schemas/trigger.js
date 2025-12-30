const mongoose = require("mongoose");
const mediaSchema = require('../../media.js');

const triggerSchema = new mongoose.Schema({
    name: String,
    description: String,
    help: String
});

const triggerGroupSchema = new mongoose.Schema({
    name: String,
    displayName: String,
    triggers: [triggerSchema],
    color: String,
    banner: mediaSchema // $$
})

module.exports = {
  triggerSchema,
  triggerGroupSchema
};