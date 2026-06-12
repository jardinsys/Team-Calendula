// Shared convert functions for both prefix and slash commands
// Core conversion logic extracted from prefix/convert.js

const mongoose = require('mongoose');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');

const CONVERT_COLOR = '#007bd8';

module.exports = {
    CONVERT_COLOR,

    async convertAltersToStates(system, names, options) {
        const results = { converted: [], notFound: [], errors: [] };

        const altersToConvert = [];
        for (const name of names) {
            const alter = await Alter.findOne({
                _id: { $in: system.alters?.IDs || [] },
                $or: [
                    { 'name.indexable': { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } },
                    { 'name.display': { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } }
                ]
            });
            if (alter) altersToConvert.push(alter);
            else results.notFound.push(name);
        }

        if (altersToConvert.length === 0)
            return { error: `No alters found matching: ${names.join(', ')}`, results };

        for (const alter of altersToConvert) {
            try {
                const newState = new State({
                    id: alter.id,
                    name: {
                        indexable: alter.name?.indexable,
                        display: alter.name?.display,
                        closedNameDisplay: alter.name?.closedNameDisplay,
                        aliases: alter.name?.aliases
                    },
                    description: alter.description,
                    color: alter.color,
                    avatar: alter.avatar,
                    proxy: alter.proxy || [],
                    signoff: alter.signoff,
                    condition: alter.condition,
                    caution: alter.caution,

                    groupIDs: alter.groupsIDs || [],

                    alters: alter.states?.map(s => s.connected_id).filter(Boolean) || [],

                    setting: alter.setting,

                    metadata: {
                        addedAt: alter.metadata?.addedAt || new Date(),
                        convertedFrom: 'alter',
                        convertedAt: new Date(),
                        originalId: alter._id.toString(),
                        importedFrom: alter.metadata?.importedFrom,
                        pluralKitId: alter.metadata?.pluralKitId,
                        pluralKitUuid: alter.metadata?.pluralKitUuid
                    }
                });

                await newState.save();

                if (!system.states) system.states = { IDs: [], conditions: [] };
                system.states.IDs.push(newState._id);

                if (alter.groupsIDs?.length > 0) {
                    await Group.updateMany(
                        { _id: { $in: alter.groupsIDs } },
                        { $addToSet: { stateIDs: newState._id.toString() } }
                    );
                }

                if (alter.states?.length > 0) {
                    const stateIds = alter.states.map(s => s.connected_id).filter(Boolean);
                    if (stateIds.length > 0) {
                        await State.updateMany(
                            { _id: { $in: stateIds } },
                            { $addToSet: { alters: newState._id.toString() } }
                        );
                    }
                }

                await Shift.updateMany(
                    { s_type: 'alter', ID: alter.id },
                    { $set: { s_type: 'state', type_name: newState.name?.display || newState.name?.indexable } }
                );

                if (!options.keep) {
                    system.alters.IDs = system.alters.IDs.filter(id => id.toString() !== alter._id.toString());

                    if (alter.groupsIDs?.length > 0) {
                        await Group.updateMany(
                            { _id: { $in: alter.groupsIDs } },
                            { $pull: { alterIDs: alter._id.toString() } }
                        );
                    }

                    if (alter.states?.length > 0) {
                        const stateIds = alter.states.map(s => s.connected_id).filter(Boolean);
                        if (stateIds.length > 0) {
                            await State.updateMany(
                                { _id: { $in: stateIds } },
                                { $pull: { alters: alter._id.toString() } }
                            );
                        }
                    }

                    await Alter.findByIdAndDelete(alter._id);
                }

                results.converted.push(alter.name?.display || alter.name?.indexable);
            } catch (err) {
                results.errors.push(`${alter.name?.display || alter.name?.indexable}: ${err.message}`);
            }
        }

        await system.save();
        return { results };
    },

    async convertStatesToAlters(system, names, options) {
        const results = { converted: [], notFound: [], errors: [] };

        const statesToConvert = [];
        for (const name of names) {
            const state = await State.findOne({
                _id: { $in: system.states?.IDs || [] },
                $or: [
                    { 'name.indexable': { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } },
                    { 'name.display': { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } }
                ]
            });
            if (state) statesToConvert.push(state);
            else results.notFound.push(name);
        }

        if (statesToConvert.length === 0)
            return { error: `No states found matching: ${names.join(', ')}`, results };

        for (const state of statesToConvert) {
            try {
                const newAlter = new Alter({
                    id: state.id,
                    name: {
                        indexable: state.name?.indexable,
                        display: state.name?.display,
                        closedNameDisplay: state.name?.closedNameDisplay,
                        aliases: state.name?.aliases
                    },
                    description: state.description,
                    color: state.color,
                    avatar: state.avatar,
                    proxy: state.proxy || [],
                    signoff: state.signoff,
                    condition: state.condition,
                    caution: state.caution,

                    groupsIDs: state.groupIDs || [],

                    states: state.alters?.map(alterId => ({
                        connected_id: alterId
                    })) || [],

                    setting: state.setting,

                    metadata: {
                        addedAt: state.metadata?.addedAt || new Date(),
                        convertedFrom: 'state',
                        convertedAt: new Date(),
                        originalId: state._id.toString(),
                        importedFrom: state.metadata?.importedFrom,
                        pluralKitId: state.metadata?.pluralKitId,
                        pluralKitUuid: state.metadata?.pluralKitUuid
                    }
                });

                await newAlter.save();

                if (!system.alters) system.alters = { IDs: [], conditions: [] };
                system.alters.IDs.push(newAlter._id);

                if (state.groupIDs?.length > 0) {
                    await Group.updateMany(
                        { _id: { $in: state.groupIDs } },
                        { $addToSet: { alterIDs: newAlter._id.toString() } }
                    );
                }

                if (state.alters?.length > 0) {
                    await Alter.updateMany(
                        { _id: { $in: state.alters } },
                        { $addToSet: { states: { connected_id: newAlter._id.toString(), name: { indexable: newAlter.name?.indexable, display: newAlter.name?.display } } } }
                    );
                }

                await Shift.updateMany(
                    { s_type: 'state', ID: state.id },
                    { $set: { s_type: 'alter', type_name: newAlter.name?.display || newAlter.name?.indexable } }
                );

                if (!options.keep) {
                    system.states.IDs = system.states.IDs.filter(id => id.toString() !== state._id.toString());

                    if (state.groupIDs?.length > 0) {
                        await Group.updateMany(
                            { _id: { $in: state.groupIDs } },
                            { $pull: { stateIDs: state._id.toString() } }
                        );
                    }

                    if (state.alters?.length > 0) {
                        await Alter.updateMany(
                            { _id: { $in: state.alters } },
                            { $pull: { states: { connected_id: state._id.toString() } } }
                        );
                    }

                    await State.findByIdAndDelete(state._id);
                }

                results.converted.push(state.name?.display || state.name?.indexable);
            } catch (err) {
                results.errors.push(`${state.name?.display || state.name?.indexable}: ${err.message}`);
            }
        }

        await system.save();
        return { results };
    }
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
