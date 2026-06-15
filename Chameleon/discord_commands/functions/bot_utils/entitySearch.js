// Entity search extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

const { escapeRegex } = require('./constants');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

/* Find an entity (alter/state/group) by name or ID (case-insensitive)
 * @param {string} identifier - Name, alias, or ID
 * @param {System} system - System to search in
 * @param {string} entityType - 'alter', 'state', 'group', or 'any'
 * @returns {Promise<{entity: Object, type: string}|null>}
 */
async function findEntity(identifier, system, entityType = 'any') {
    if (!identifier || !system) return null;

    const searchName = identifier.toLowerCase();

    const findInCollection = async (Model, ids) => {
        return await Model.findOne({
            _id: { $in: ids || [] },
            $or: [
                { _id: identifier },
                { 'name.indexable': { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } },
                { 'name.display': { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } },
                { 'name.aliases': { $elemMatch: { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } } }
            ]
        });
    };

    if (entityType === 'alter' || entityType === 'any') {
        const alter = await findInCollection(Alter, system.alters?.IDs);
        if (alter) return { entity: alter, type: 'alter' };
    }

    if (entityType === 'state' || entityType === 'any') {
        const state = await findInCollection(State, system.states?.IDs);
        if (state) return { entity: state, type: 'state' };
    }

    if (entityType === 'group' || entityType === 'any') {
        const group = await findInCollection(Group, system.groups?.IDs);
        if (group) return { entity: group, type: 'group' };
    }

    return null;
}

/* Find an alter by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
async function findAlterByName(name, system) {
    const result = await findEntity(name, system, 'alter');
    return result?.entity || null;
}

/* Find a state by name (case-insensitive) - backward compatibility
 * @returns {Promise<State|null>}
 */
async function findStateByName(name, system) {
    const result = await findEntity(name, system, 'state');
    return result?.entity || null;
}

/* Find a group by name (case-insensitive) - backward compatibility
 * @returns {Promise<Group|null>}
 */
async function findGroupByName(name, system) {
    const result = await findEntity(name, system, 'group');
    return result?.entity || null;
}

/* Find as many entities as possible by names/IDs
 * @param {string[]} identifiers - Array of names, aliases, or IDs
 * @param {System} system - System to search in
 * @returns {Promise<{found: Array<{entity: Object, type: string}>, notFound: string[]}>}
 */
async function findMultipleEntities(identifiers, system) {
    const found = [];
    const notFound = [];

    for (const identifier of identifiers) {
        const result = await findEntity(identifier, system);
        if (result) {
            found.push(result);
        } else {
            notFound.push(identifier);
        }
    }

    return { found, notFound };
}

module.exports = {
    escapeRegex,
    findEntity,
    findAlterByName,
    findStateByName,
    findGroupByName,
    findMultipleEntities,
};
