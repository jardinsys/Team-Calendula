const sysDB = require("../database");
const { groupPrivacySchema } = require("./settings");
const { createEntitySchema, applyEntityDefaults } = require('./entityBase');

const groupSchema = createEntitySchema({
    createdAt: { type: Date, default: Date.now },
    type: {
        name: String,
        canFront: { type: String, enum: ['yes', 'no'], default: 'yes' },
    },
    alterIDs: [String],
    stateIDs: [String],
}, groupPrivacySchema);

applyEntityDefaults(groupSchema, 'group');

const Group = sysDB.model('Group', groupSchema);
module.exports = Group;
