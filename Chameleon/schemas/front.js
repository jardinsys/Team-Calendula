const mongoose = require("mongoose");
const sysDB = require("../database");

const shiftSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    s_type: { type: String },
    alterID: { type: String, ref: 'Alter' },
    stateID: { type: String, ref: 'State' },
    groupID: { type: String, ref: 'Group' },
    type_name: String,
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    statuses: [{
        status: String,
        startTime: { type: Date, default: Date.now },
        endTime: Date,
        layerID: mongoose.Schema.Types.ObjectId,
        hidden: { type: String, enum: ['y', 'n', 'trusted'] },
    }]
});


const Shift = sysDB.model('Shift', shiftSchema);

const layerSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    name: String,
    color: String,
    shifts: [{type: mongoose.Schema.Types.ObjectId, ref: 'Shift'}],
});

module.exports = {
    Shift,
    layerSchema
};