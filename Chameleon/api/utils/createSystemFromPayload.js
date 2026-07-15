// Shared system creation from staged payload
// Used by both API route (POST /api/system) and BotSessionManager.commit()
//
// Two-phase approach:
//   Phase 1: Bulk insert entities (fast, no transaction)
//   Phase 2: Create system + link entities (transaction, atomic)
//   If phase 2 fails: immediate cleanup of orphans
//   Safety net: TTL index on entities (5 min)

const path = require('path');
const mongoose = require('mongoose');
const sysDB = require('../../database');

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
 *
 * Two-phase commit:
 *   Phase 1: Bulk insert entities (no transaction, fast)
 *   Phase 2: Create system + link (transaction, atomic)
 *   On failure: immediate cleanup of orphaned entities
 *   Safety net: TTL index catches anything that slips through
 *
 * @param {string|ObjectId} userId - MongoDB User _id
 * @param {Object} payload - Staged payload from useSystemSession or BotSessionManager
 * @returns {Promise<{system, user}>}
 */
async function createSystemFromPayload(userId, payload) {
    // Track created entity IDs for cleanup
    const createdAlterIds = [];
    const createdStateIds = [];
    const createdGroupIds = [];

    try {
        // ══════════════════════════════════════════════
        // PHASE 0: Validate user (quick check, no DB writes)
        // ══════════════════════════════════════════════
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Handle orphaned system reference (user.systemID exists but system doesn't)
        if (user.systemID) {
            const existingSystem = await System.findById(user.systemID);
            if (!existingSystem) {
                console.log(`[System] User ${userId} has orphaned systemID ${user.systemID} — cleaning up`);
                user.systemID = null;
                await user.save();
            } else {
                throw new Error('You already have a system');
            }
        }

        const isStagedPayload = payload.sys_type && payload.alters && payload.states && payload.groups;

        // ══════════════════════════════════════════════
        // PHASE 1: Bulk insert entities (no transaction, fast)
        // ══════════════════════════════════════════════
        let alterDocs = [];
        let stateDocs = [];
        let groupDocs = [];

        if (isStagedPayload && payload.alters?.entities?.length > 0) {
            alterDocs = payload.alters.entities.map(entityData => {
                const data = { ...entityData };
                delete data._id;
                delete data.__v;
                return data; // No systemID yet — set in phase 2
            });
        }

        if (isStagedPayload && payload.states?.entities?.length > 0) {
            stateDocs = payload.states.entities.map(entityData => {
                const data = { ...entityData };
                delete data._id;
                delete data.__v;
                return data;
            });
        }

        if (isStagedPayload && payload.groups?.entities?.length > 0) {
            groupDocs = payload.groups.entities.map(entityData => {
                const data = { ...entityData };
                delete data._id;
                delete data.__v;
                return data;
            });
        }

        // Bulk insert all entity types in parallel (no session, no transaction)
        const [createdAlters, createdStates, createdGroups] = await Promise.all([
            alterDocs.length > 0 ? Alter.insertMany(alterDocs, { ordered: false }) : [],
            stateDocs.length > 0 ? State.insertMany(stateDocs, { ordered: false }) : [],
            groupDocs.length > 0 ? Group.insertMany(groupDocs, { ordered: false }) : [],
        ]);

        createdAlterIds.push(...createdAlters.map(a => a._id));
        createdStateIds.push(...createdStates.map(s => s._id));
        createdGroupIds.push(...createdGroups.map(g => g._id));

        console.log(`[System] Phase 1 complete: ${createdAlterIds.length} alters, ${createdStateIds.length} states, ${createdGroupIds.length} groups inserted`);

        // ══════════════════════════════════════════════
        // PHASE 2: Create system + link entities (transaction, atomic)
        // ══════════════════════════════════════════════
        const session = await sysDB.startSession();
        session.startTransaction();

        try {
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

            // --- Create System (with entity IDs from phase 1) ---
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
                alters: { conditions: alterConditions, IDs: createdAlterIds.map(id => id.toString()) },
                states: { conditions: stateConditions, IDs: createdStateIds.map(id => id.toString()) },
                groups: { conditions: groupConditions, IDs: createdGroupIds.map(id => id.toString()) },
                setting,
                front
            });

            await system.save({ session });

            // --- Link entities to system (set systemID on all entities) ---
            const allEntityIds = [...createdAlterIds, ...createdStateIds, ...createdGroupIds];
            if (allEntityIds.length > 0) {
                // Link alters
                if (createdAlterIds.length > 0) {
                    await Alter.updateMany(
                        { _id: { $in: createdAlterIds } },
                        { $set: { systemID: system._id.toString() } },
                        { session }
                    );
                }
                // Link states
                if (createdStateIds.length > 0) {
                    await State.updateMany(
                        { _id: { $in: createdStateIds } },
                        { $set: { systemID: system._id.toString() } },
                        { session }
                    );
                }
                // Link groups
                if (createdGroupIds.length > 0) {
                    await Group.updateMany(
                        { _id: { $in: createdGroupIds } },
                        { $set: { systemID: system._id.toString() } },
                        { session }
                    );
                }
            }

            // Legacy path: link existing entities by ID (if no entities were created in phase 1)
            if (alterIds.length > 0 && createdAlterIds.length === 0) {
                const existingAlterIds = await Alter.distinct('_id', { _id: { $in: alterIds } }).session(session);
                if (existingAlterIds.length > 0) {
                    await Alter.updateMany(
                        { _id: { $in: existingAlterIds } },
                        { $set: { systemID: system._id.toString() } },
                        { session }
                    );
                }
            }
            if (stateIds.length > 0 && createdStateIds.length === 0) {
                const existingStateIds = await State.distinct('_id', { _id: { $in: stateIds } }).session(session);
                if (existingStateIds.length > 0) {
                    await State.updateMany(
                        { _id: { $in: existingStateIds } },
                        { $set: { systemID: system._id.toString() } },
                        { session }
                    );
                }
            }
            if (groupIds.length > 0 && createdGroupIds.length === 0) {
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

            // --- Commit Transaction ---
            await session.commitTransaction();
            console.log(`[System] Created new system ${system._id} for user ${user._id} ${isStagedPayload ? '(staged)' : ''}`);

            return { system, user };
        } catch (err) {
            // Phase 2 failed — abort transaction
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    } catch (err) {
        // ══════════════════════════════════════════════
        // CLEANUP: Delete orphaned entities from phase 1
        // ══════════════════════════════════════════════
        const cleanupIds = [...createdAlterIds, ...createdStateIds, ...createdGroupIds];
        if (cleanupIds.length > 0) {
            console.log(`[System] Phase 2 failed — cleaning up ${cleanupIds.length} orphaned entities`);
            try {
                if (createdAlterIds.length > 0) await Alter.deleteMany({ _id: { $in: createdAlterIds } });
                if (createdStateIds.length > 0) await State.deleteMany({ _id: { $in: createdStateIds } });
                if (createdGroupIds.length > 0) await Group.deleteMany({ _id: { $in: createdGroupIds } });
                console.log(`[System] Cleanup complete`);
            } catch (cleanupErr) {
                console.error(`[System] Cleanup failed (TTL index will catch orphans):`, cleanupErr.message);
            }
        }
        throw err;
    }
}

module.exports = { createSystemFromPayload };
