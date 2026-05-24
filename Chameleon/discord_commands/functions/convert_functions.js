// Shared convert functions for both prefix and slash commands
// Core conversion logic extracted from prefix/convert.js

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('./bot_utils');

const CONVERT_COLOR = '#007bd8';

// Placeholder: Core convert functions will be extracted here
// Currently the full logic lives in prefix/convert.js
// TODO: Extract convertAltersToStates, convertStatesToAlters

module.exports = {
    CONVERT_COLOR,

    // Placeholder functions — full implementation in prefix/convert.js
    async convertAltersToStates(interaction, system, names, options) {
        // TODO: Extract from prefix/convert.js
        return { error: 'Convert not yet available via slash commands. Use sys!convert alter <name> to state' };
    },

    async convertStatesToAlters(interaction, system, names, options) {
        // TODO: Extract from prefix/convert.js
        return { error: 'Convert not yet available via slash commands. Use sys!convert state <name> to alter' };
    }
};
