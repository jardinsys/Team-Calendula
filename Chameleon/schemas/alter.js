const sysDB = require("../database");
const { alterPrivacySchema } = require("./settings");
const { createEntitySchema, applyEntityDefaults, alterConnectedStateSchema } = require('./entityBase');

const alterSchema = createEntitySchema({
    genesisDate: Date,
    pronouns: [String],
    states: [alterConnectedStateSchema],
    groupsIDs: [String],
    activeStates: {
        priority: String,
        all: [String],
    },
}, alterPrivacySchema);

applyEntityDefaults(alterSchema, 'alter');

const Alter = sysDB.model('Alter', alterSchema);
module.exports = Alter;
