const mongoose = require("mongoose");
const sysDB = require("../database");

const shiftSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    s_type: { type: String, enum: ['alter', 'state', 'group'] },
    ID: String,
    type_name: String,
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    parentShift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
    childShifts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }],
    statuses: [{
        status: String,
        battery: Number,
        caution: {
            c_type: String,
            detail: String,
        },
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
    shifts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }],
    status: String,
    battery: Number,
    caution: {
        c_type: String,
        detail: String,
    },
});

module.exports = {
    Shift,
    layerSchema
};