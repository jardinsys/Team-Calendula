const sysDB = require("../database");
const { alterPrivacySchema } = require("./settings");
const { createEntitySchema, applyEntityDefaults } = require('./entityBase');

const stateSchema = createEntitySchema({
    genesisDate: { type: Date, default: Date.now },
    pronouns: [String],
    alters: [String],
    groupIDs: [String],
}, alterPrivacySchema);

applyEntityDefaults(stateSchema, 'state');

const State = sysDB.model('State', stateSchema);
module.exports = State;
