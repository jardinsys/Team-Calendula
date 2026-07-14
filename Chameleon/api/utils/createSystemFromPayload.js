// Shared system creation from staged payload
// Used by both API route (POST /api/system) and BotSessionManager.commit()

const path = require('path');
const mongoose = require('mongoose');
const sysDB = require('../../database'); // Use the same connection as models

// Resolve schemas from Chameleon folder
const chameleonDir = path.resolve(__dirname, '../..');
const System = require(path.join(chameleonDir, 'schemas/system'));
const User = require(path.join(chameleonDir, 'schemas/user'));
const Alter = require(path.join(chameleonDir, 'schemas/alter'));
const State = require(path.join(chameleonDir, 'schemas/state'));
const Group = require(path.join(chameleonDir, 'schemas/group'));
const { PrivacyBucket, mergePrivacySettings } = require(path.join(chameleonDir, 'schemas/settings'));

/**
 * Create a system from a staged payload (used by both API and bot)
 * @param {string|ObjectId} userId - MongoDB User _id
 * @param {Object} payload - Staged payload from useSystemSession or BotSessionManager
 * @returns {Promise<{system, user}>}
 */
async function createSystemFromPayload(userId, payload) {
    const session = await sysDB.startSession(); // Use sysDB connection, not default mongoose
    session.startTransaction();
    
    try {
        const user = await User.findById(userId).session(session);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        if (user.systemID) {
            throw new Error('You already have a system');
        }
        
        const isStagedPayload = payload.sys_type && payload.alters && payload.states && payload.groups;
        
        // --- Privacy Buckets ---
        let strangersBucketId, friendsBucketId, strangersBucketName, friendsBucketName;
        const privacyBuckets = payload.privacyBuckets || [];

        if (privacyBuckets.length >= 2 && typeof privacyBuckets[0] === 'object') {
            strangersBucketName = privacyBuckets[0].name || 'Strangers';
            friendsBucketName = privacyBuckets[1].name || 'Friends';
            const strangersBucket = new PrivacyBucket({ 
                name: strangersBucketName,
                friends: privacyBuckets[0].friends || [] 
            });
            const friendsBucket = new PrivacyBucket({ 
                name: friendsBucketName,
                friends: privacyBuckets[1].friends || [] 
            });
            await strangersBucket.save({ session });
            await friendsBucket.save({ session });
            strangersBucketId = strangersBucket._id;
            friendsBucketId = friendsBucket._id;
        } else if (privacyBuckets.length >= 2 && typeof privacyBuckets[0] === 'string') {
            strangersBucketId = new mongoose.Types.ObjectId(privacyBuckets[0]);
            friendsBucketId = new mongoose.Types.ObjectId(privacyBuckets[1]);
            strangersBucketName = 'Strangers';
            friendsBucketName = 'Friends';
        } else {
            strangersBucketName = 'Strangers';
            friendsBucketName = 'Friends';
            const strangersBucket = new PrivacyBucket({ name: strangersBucketName, friends: [] });
            const friendsBucket = new PrivacyBucket({ name: friendsBucketName, friends: [] });
            await strangersBucket.save({ session });
            await friendsBucket.save({ session });
            strangersBucketId = strangersBucket._id;
            friendsBucketId = friendsBucket._id;
        }
        // --- System Type ---
        let sysType;
        if (isStagedPayload) {
            sysType = {
                name: payload.sys_type.name || 'None',
                dd: payload.sys_type.dd || {},
                isSystem: !!payload.sys_type.isSystem,
                isFragmented: !!payload.sys_type.isFragmented,
                isDissociative: !!payload.sys_type.isDissociative,
                dissociativeStateName: payload.sys_type.dissociativeStateName || 'Dissociated',
                onboardingCompleted: !!payload.sys_type.onboardingCompleted,
            };
        } else {
            sysType = payload.sys_type || {
                name: 'None',
                dd: {},
                isSystem: false,
                isFragmented: false,
                isDissociative: false,
                onboardingCompleted: false
            };
        }
        
        // --- System Name ---
        let nameDisplay, nameIndexable;
        if (payload.name && typeof payload.name === 'object') {
            nameDisplay = payload.name.display;
            nameIndexable = payload.name.indexable;
        } else {
            nameDisplay = payload.name || payload.systemName || 'My System';
            nameIndexable = nameDisplay.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
        }
        
        // --- Entity Conditions ---
        const alterConditions = (isStagedPayload && payload.alters?.conditions) 
            ? payload.alters.conditions 
            : (sysType.isSystem ? [{ name: 'Dormant', settings: { hide_to_self: false, include_in_Count: true } }] : []);
        
        const stateConditions = (isStagedPayload && payload.states?.conditions) 
            ? payload.states.conditions 
            : (sysType.isFragmented ? [{ name: 'Remission', settings: { hide_to_self: false, include_in_Count: true } }] : []);
        
        const groupConditions = (isStagedPayload && payload.groups?.conditions) 
            ? payload.groups.conditions 
            : [];
        
        // --- Entity IDs (from staged payload) ---
        const alterIds = (isStagedPayload && payload.alters?.IDs) ? payload.alters.IDs.map(id => new mongoose.Types.ObjectId(id)) : [];
        const stateIds = (isStagedPayload && payload.states?.IDs) ? payload.states.IDs.map(id => new mongoose.Types.ObjectId(id)) : [];
        const groupIds = (isStagedPayload && payload.groups?.IDs) ? payload.groups.IDs.map(id => new mongoose.Types.ObjectId(id)) : [];
        
        // --- Settings ---
        const setting = isStagedPayload && payload.setting ? payload.setting : {
            friendAutoBucket: friendsBucketName,
            privacy: [
                {
                    bucket: strangersBucketName,
                    settings: mergePrivacySettings(strangersBucketName, 'system')
                },
                {
                    bucket: friendsBucketName,
                    settings: mergePrivacySettings(friendsBucketName, 'system')
                }
            ]
        };
        
        // --- Front Layers ---
        let front = {};
        if (isStagedPayload && payload.front) {
            front = {
                status: payload.front.status || '',
                caution: payload.front.caution || '',
                layers: (payload.front.layers || []).map(layer => {
                    let layerId;
                    if (layer._id && mongoose.Types.ObjectId.isValid(layer._id)) {
                        layerId = new mongoose.Types.ObjectId(layer._id);
                    } else {
                        layerId = new mongoose.Types.ObjectId();
                    }
                    return {
                        _id: layerId,
                        name: layer.name,
                        color: layer.color || '#8b5cf6',
                        shifts: (payload.front.shifts || []).map(shift => ({
                            ...shift,
                            timestamp: shift.timestamp ? new Date(shift.timestamp) : new Date()
                        }))
                    };
                })
            };
        }
        
        // --- Create System ---
        const system = new System({
            users: [user._id],
            metadata: { joinedAt: new Date() },
            name: {
                display: nameDisplay,
                ...(nameIndexable && { indexable: nameIndexable })
            },
            description: payload.description || '',
            sys_type: sysType,
            privacyBuckets: [strangersBucketId, friendsBucketId],
            alters: { conditions: alterConditions, IDs: alterIds },
            states: { conditions: stateConditions, IDs: stateIds },
            groups: { conditions: groupConditions, IDs: groupIds },
            setting,
            front
        });
        
        await system.save({ session });
        
        // Link entities to system
        // If full entity data is provided (dryRun registration), create entities from payload
        // Otherwise, link existing entities by ID
        const createdAlterIds = [];
        const createdStateIds = [];
        const createdGroupIds = [];

        // Create alters from payload entity data
        if (payload.alters?.entities && payload.alters.entities.length > 0) {
            log.info('Commit', 'Creating ' + payload.alters.entities.length + ' alters from payload');
            for (const entityData of payload.alters.entities) {
                try {
                    const alterData = { ...entityData };
                    delete alterData._id; // Let Mongoose generate new ID
                    delete alterData.__v;
                    const alter = new Alter(alterData);
                    alter.systemID = system._id.toString();
                    await alter.save({ session });
                    createdAlterIds.push(alter._id);
                    log.step('Commit', createdAlterIds.length, payload.alters.entities.length, 'Created alter: ' + (alter.name?.display || alter.name?.indexable || 'Unknown'));
                } catch (err) {
                    log.fail('Commit', 'Failed to create alter: ' + (entityData.name?.display || entityData.name?.indexable || 'Unknown'), err);
                }
            }
            system.alters.IDs = createdAlterIds.map(id => id.toString());
        } else if (alterIds.length > 0) {
            // Legacy path: link existing entities by ID
            const existingAlterIds = await Alter.distinct('_id', { _id: { $in: alterIds } }).session(session);
            if (existingAlterIds.length > 0) {
                await Alter.updateMany(
                    { _id: { $in: existingAlterIds } },
                    { $set: { systemID: system._id.toString() } },
                    { session }
                );
            }
        }

        // Create states from payload entity data
        if (payload.states?.entities && payload.states.entities.length > 0) {
            log.info('Commit', 'Creating ' + payload.states.entities.length + ' states from payload');
            for (const entityData of payload.states.entities) {
                try {
                    const stateData = { ...entityData };
                    delete stateData._id;
                    delete stateData.__v;
                    const state = new State(stateData);
                    state.systemID = system._id.toString();
                    await state.save({ session });
                    createdStateIds.push(state._id);
                    log.step('Commit', createdStateIds.length, payload.states.entities.length, 'Created state: ' + (state.name?.display || state.name?.indexable || 'Unknown'));
                } catch (err) {
                    log.fail('Commit', 'Failed to create state: ' + (entityData.name?.display || entityData.name?.indexable || 'Unknown'), err);
                }
            }
            system.states.IDs = createdStateIds.map(id => id.toString());
        } else if (stateIds.length > 0) {
            const existingStateIds = await State.distinct('_id', { _id: { $in: stateIds } }).session(session);
            if (existingStateIds.length > 0) {
                await State.updateMany(
                    { _id: { $in: existingStateIds } },
                    { $set: { systemID: system._id.toString() } },
                    { session }
                );
            }
        }

        // Create groups from payload entity data
        if (payload.groups?.entities && payload.groups.entities.length > 0) {
            log.info('Commit', 'Creating ' + payload.groups.entities.length + ' groups from payload');
            for (const entityData of payload.groups.entities) {
                try {
                    const groupData = { ...entityData };
                    delete groupData._id;
                    delete groupData.__v;
                    const group = new Group(groupData);
                    group.systemID = system._id.toString();
                    await group.save({ session });
                    createdGroupIds.push(group._id);
                    log.step('Commit', createdGroupIds.length, payload.groups.entities.length, 'Created group: ' + (group.name?.display || group.name?.indexable || 'Unknown'));
                } catch (err) {
                    log.fail('Commit', 'Failed to create group: ' + (entityData.name?.display || entityData.name?.indexable || 'Unknown'), err);
                }
            }
            system.groups.IDs = createdGroupIds.map(id => id.toString());
        } else if (groupIds.length > 0) {
            const existingGroupIds = await Group.distinct('_id', { _id: { $in: groupIds } }).session(session);
            if (existingGroupIds.length > 0) {
                await Group.updateMany(
                    { _id: { $in: existingGroupIds } },
                    { $set: { systemID: system._id.toString() } },
                    { session }
                );
            }
        }

        // --- Update User ---
        user.systemID = system._id;
        await user.save({ session });
        
        // Auto-create dissociative state for dissociative users
        if (sysType.isDissociative) {
            const stateName = sysType.dissociativeStateName || 'Dissociated';
            const stateIndexable = stateName.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
            const dissociatedState = new State({
                name: {
                    display: stateName,
                    ...(stateIndexable && { indexable: stateIndexable }),
                },
                description: `A ${stateName.toLowerCase()} state`,
                proxy: [stateIndexable || stateName.toLowerCase()],
            });
            await dissociatedState.save({ session });
            system.states.IDs.push(dissociatedState._id);
            await system.save({ session });
        }
        
        await session.commitTransaction();
        
        console.log(`[System] Created new system ${system._id} for user ${user._id} ${isStagedPayload ? '(staged)' : ''}`);
        
        return { system, user };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        await session.endSession();
    }
}

module.exports = { createSystemFromPayload };