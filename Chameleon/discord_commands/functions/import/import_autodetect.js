// Auto-detect import format and delegate to the appropriate processor
// Extracted from import_functions.js

const { processTupperboxData } = require('./import_tupperbox');
const { processOctoconData } = require('./import_octocon');
const { processPluralKitData } = require('./import_pluralkit');

async function importAutoDetect(system, user, fileData, options) {
    const data = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

    // Detect format
    if (data.tuppers) {
        return await processTupperboxData(system, data, options);
    } else if (data.user && data.alters && data.tags) {
        // Octocon format: user + alters + tags (tags distinguishes from PK which has members)
        return await processOctoconData(system, user, data, options);
    } else if (data.members || data.id) {
        return await processPluralKitData(system, user, {
            system: data,
            members: data.members || [],
            groups: data.groups || [],
            switches: data.switches || []
        }, options);
    } else {
        throw new Error('Could not detect file format. Please specify the source (pluralkit, tupperbox, simplyplural, octocon).');
    }
}

module.exports = { importAutoDetect };
