// Entity-System Linking Utilities
// Bidirectional entity creation, linking, and management between entities and systems

const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

/**
 * Create an entity, set systemID, save, and push to system's IDs array.
 * Replaces the inline entity.save() + system.X.IDs.push() pattern.
 * @param {Object} entity - Unsaved Mongoose entity document (Alter, State, or Group)
 * @param {Object} system - Loaded System document
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @returns {Object} The saved entity
 */
async function createAndLinkEntity(entity, system, entityType) {
    entity.systemID = system._id.toString();
    await entity.save();
    const key = entityType + 's'; // 'alters', 'states', 'groups'
    system[key] = system[key] || { IDs: [] };
    if (!system[key].IDs.includes(entity._id)) {
        system[key].IDs.push(entity._id);
    }
    await system.save();
    return entity;
}

/**
 * Remove an entity from its system's IDs array (for deletion workflows).
 * Caller must still handle entity-level cleanup (groups, shifts, etc.) and system.save().
 * @param {string|ObjectId} entityId - The entity's _id
 * @param {Object} system - Loaded System document
 * @param {string} entityType - 'alter', 'state', or 'group'
 */
function unlinkEntityFromSystem(entityId, system, entityType) {
    const key = entityType + 's';
    if (system[key]?.IDs) {
        system[key].IDs = system[key].IDs.filter(id => id.toString() !== entityId.toString());
    }
}

/**
 * Publish an entity:deleted event via Redis pub/sub.
 * Call after every deleteOne / findByIdAndDelete since Mongoose hooks
 * don't uniformly cover both methods.
 */
function publishDeleteEvent(systemId, entityType, entityId) {
    try {
        const { publishEvent } = require('../../redis');
        publishEvent(systemId, { type: 'entity:deleted', entityType, entityId: entityId.toString() });
    } catch (_) {}
}

/**
 * Bidirectional group membership link.
 * Links entity → group AND group → entity.
 * @param {string|ObjectId} entityId - The alter or state _id
 * @param {string|ObjectId} groupId - The group _id
 * @param {string} entityType - 'alter' or 'state' (default: 'alter')
 */
async function linkEntityToGroup(entityId, groupId, entityType = 'alter') {
    const group = await Group.findById(groupId);
    if (!group) return;

    const idArray = entityType === 'state' ? 'stateIDs' : 'alterIDs';
    group[idArray] = group[idArray] || [];
    if (!group[idArray].includes(entityId)) {
        group[idArray].push(entityId);
        await group.save();
    }

    const Model = entityType === 'state' ? State : Alter;
    const entity = await Model.findById(entityId);
    if (entity) {
        entity.groupsIDs = entity.groupsIDs || [];
        if (!entity.groupsIDs.includes(groupId)) {
            entity.groupsIDs.push(groupId);
            await entity.save();
        }
    }
}

/**
 * Bidirectional group membership unlink.
 * Unlinks entity ↔ group on both sides.
 * @param {string|ObjectId} entityId - The alter or state _id
 * @param {string|ObjectId} groupId - The group _id
 * @param {string} entityType - 'alter' or 'state' (default: 'alter')
 */
async function unlinkEntityFromGroup(entityId, groupId, entityType = 'alter') {
    const group = await Group.findById(groupId);
    if (group) {
        const idArray = entityType === 'state' ? 'stateIDs' : 'alterIDs';
        if (group[idArray]) {
            group[idArray] = group[idArray].filter(id => id.toString() !== entityId.toString());
            await group.save();
        }
    }

    const Model = entityType === 'state' ? State : Alter;
    const entity = await Model.findById(entityId);
    if (entity?.groupsIDs) {
        entity.groupsIDs = entity.groupsIDs.filter(id => id.toString() !== groupId.toString());
        await entity.save();
    }
}

// ==== EDIT HELPERS ====

/**
 * Get the correct target for editing based on current mode
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Session data containing mode
 * @returns {Object}
 */
function getEditTarget(entity, session) {
    if (session?.mode === 'mask') return entity.mask || entity;
    if (session?.mode === 'server' && session?.serverId) {
        const serverSettings = entity.discord?.server?.find(s => s.id === session.serverId);
        return serverSettings || entity.discord || entity;
    }
    return entity.discord || entity;
}

/**
 * Update an entity property based on current mode
 * @param {Object} entity - The entity to update
 * @param {Object} session - Session data
 * @param {string} property - Property path to update
 * @param {*} value - New value
 */
function updateEntityProperty(entity, session, property, value) {
    if (session?.mode === 'server' && session?.serverId) {
        if (!entity.discord) entity.discord = {};
        if (!entity.discord.server) entity.discord.server = [];
        let serverEntry = entity.discord.server.find(s => s.id === session.serverId);
        if (!serverEntry) {
            serverEntry = { id: session.serverId };
            entity.discord.server.push(serverEntry);
        }
        const parts = property.split('.');
        let current = serverEntry;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return;
    }

    const target = session?.mode === 'mask' ? 'mask' : 'discord';
    if (!entity[target]) entity[target] = {};

    const parts = property.split('.');
    let current = entity[target];

    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

// ==== CONDITION MANAGEMENT ====

/**
 * Ensure a condition exists in the system
 * @param {System} system - System to update
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @param {string} conditionName - Name of the condition
 */
async function ensureConditionExists(system, entityType, conditionName) {
    const conditionsPath = `${entityType}s.conditions`;
    const conditions = system[`${entityType}s`]?.conditions || [];

    const exists = conditions.some(c => c.name?.toLowerCase() === conditionName.toLowerCase());
    if (!exists) {
        if (!system[`${entityType}s`]) system[`${entityType}s`] = { conditions: [], IDs: [] };

        system[`${entityType}s`].conditions.push({
            name: conditionName,
            settings: {
                hide_to_self: false,
                include_in_Count: true
            }
        });
        await system.save();
    }
}

module.exports = {
    createAndLinkEntity,
    unlinkEntityFromSystem,
    publishDeleteEvent,
    linkEntityToGroup,
    unlinkEntityFromGroup,
    getEditTarget,
    updateEntityProperty,
    ensureConditionExists,
};