// Embed Color & Alter Display Utilities
// System/entity embed color resolution and alter display merging with active states

const State = require('../../../schemas/state');
const constants = require('./constants');
const { ENTITY_COLORS } = constants;

/* Get embed color for a system
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getSystemEmbedColor(system) {
    return system?.color || ENTITY_COLORS.system || null;
}

/* Get embed color for an entity with priority: entity.color > system.color > default
 * @param {Object} entity - Entity document (alter/state/group)
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getEntityEmbedColor(entity, system) {
    return entity?.color || system?.color || ENTITY_COLORS.system || null;
}

/**
 * Resolve display fields for an alter with active states.
 * Priority: activeStates.all[0] (priority) > activeStates.all[1..n] > alter's own fields.
 * @param {Object} alter - Alter document
 * @param {Object} system - System document (unused, kept for API consistency)
 * @returns {Object} Merged display: { name, avatar, color, description, signoff, pronouns, proxy, caution }
 */
async function resolveAlterDisplay(alter, system) {
    const display = {
        name: alter.name?.display || alter.name?.indexable || null,
        avatar: alter.avatar?.url || null,
        color: alter.color || null,
        description: alter.description || null,
        signoff: alter.signoff || null,
        pronouns: alter.pronouns || null,
        proxy: alter.proxy || null,
        caution: alter.caution || null,
        hasActiveStates: false
    };

    const activeIds = alter.activeStates?.all;
    if (!activeIds || activeIds.length === 0) return display;

    display.hasActiveStates = true;

    let states;
    try {
        states = await State.find({ _id: { $in: activeIds } });
    } catch {
        return display;
    }

    const stateMap = new Map();
    for (const s of states) {
        stateMap.set(s._id.toString(), s);
    }

    for (const stateId of activeIds) {
        const state = stateMap.get(stateId.toString());
        if (!state) continue;

        if (!display.name && (state.name?.display || state.name?.indexable)) {
            display.name = state.name?.display || state.name?.indexable;
        }
        if (!display.avatar && state.avatar?.url) {
            display.avatar = state.avatar.url;
        }
        if (!display.color && state.color) {
            display.color = state.color;
        }
        if (!display.description && state.description) {
            display.description = state.description;
        }
        if (!display.signoff && state.signoff) {
            display.signoff = state.signoff;
        }
        if (!display.proxy && state.proxy?.length) {
            display.proxy = state.proxy;
        }
        if (!display.caution && state.caution?.c_type) {
            display.caution = state.caution;
        }
    }

    return display;
}

module.exports = {
    getSystemEmbedColor,
    getEntityEmbedColor,
    resolveAlterDisplay,
};