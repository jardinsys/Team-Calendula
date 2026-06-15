// Shared system creation from staged payload
// Used by both API route (POST /api/system) and BotSessionManager.commit()

const path = require('path');
const mongoose = require('mongoose');

// Resolve schemas from Chameleon folder
const chameleonDir = path.resolve(__dirname, '../..');
const System = require(path.join(chameleonDir, 'schemas/system'));
const User = require(path.join(chameleonDir, 'schemas/user'));
const Alter = require(path.join(chameleonDir, 'schemas/alter'));
const State = require(path.join(chameleonDir, 'schemas/state'));
const Group = require(path.join(chameleonDir, 'schemas/group'));
const { PrivacyBucket } = require(path.join(chameleonDir, 'schemas/settings'));

/**
 * Create a system from a staged payload (used by both API and bot)
 * @param {string|ObjectId} userId - MongoDB User _id
 * @param {Object} payload - Staged payload from useSystemSession or BotSessionManager
 * @returns {Promise<{system, user}>}
 */
async function createSystemFromPayload(userId, payload) {
    const session = await mongoose.startSession();
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
        let strangersBucketId, friendsBucketId;
        const privacyBuckets = payload.privacyBuckets || [];
        
        if (privacyBuckets.length >= 2 && typeof privacyBuckets[0] === 'object') {
            // Staged: privacyBuckets are objects with name/friends
            const strangersBucket = new PrivacyBucket({ 
                name: privacyBuckets[0].name || 'Strangers', 
                friends: privacyBuckets[0].friends || [] 
            });
            const friendsBucket = new PrivacyBucket({ 
                name: privacyBuckets[1].name || 'Friends', 
                friends: privacyBuckets[1].friends || [] 
            });
            await strangersBucket.save({ session });
            await friendsBucket.save({ session });
            strangersBucketId = strangersBucket._id;
            friendsBucketId = friendsBucket._id;
        } else if (privacyBuckets.length >= 2 && typeof privacyBuckets[0] === 'string') {
            // Staged: privacyBuckets are pre-created IDs
            strangersBucketId = new mongoose.Types.ObjectId(privacyBuckets[0]);
            friendsBucketId = new mongoose.Types.ObjectId(privacyBuckets[1]);
        } else {
            // Simple mode: create default buckets
            const strangersBucket = new PrivacyBucket({ name: 'Strangers', friends: [] });
            const friendsBucket = new PrivacyBucket({ name: 'Friends', friends: [] });
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
            friendAutoBucket: 'Friends',
            privacy: [
                {
                    bucket: 'Strangers',
                    settings: { mask: false, description: false, banner: false, avatar: false, birthday: false, pronouns: false, metadata: false, caution: false, hidden: true }
                },
                {
                    bucket: 'Friends',
                    settings: { mask: false, description: true, banner: true, avatar: true, birthday: false, pronouns: true, metadata: false, caution: false, hidden: false }
                }
            ]
        };
        
        // --- Front Layers ---
        let front = {};
        if (isStagedPayload && payload.front) {
            front = {
                status: payload.front.status || '',
                caution: payload.front.caution || '',
                layers: (payload.front.layers || []).map(layer => ({
                    _id: layer._id ? new mongoose.Types.ObjectId(layer._id) : new mongoose.Types.ObjectId(),
                    name: layer.name,
                    color: layer.color || '#8b5cf6',
                    shifts: (payload.front.shifts || []).map(shift => ({
                        ...shift,
                        timestamp: shift.timestamp ? new Date(shift.timestamp) : new Date()
                    }))
                }))
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
            privacyBuckets: [strangersBucketId, friendsBucketId].filter(Boolean),
            alters: { conditions: alterConditions, IDs: alterIds },
            states: { conditions: stateConditions, IDs: stateIds },
            groups: { conditions: groupConditions, IDs: groupIds },
            setting,
            front
        });
        
        await system.save({ session });
        
        // Link entities to system (for staged IDs)
        if (alterIds.length > 0) {
            await Alter.updateMany(
                { _id: { $in: alterIds } },
                { $set: { systemID: system._id.toString() } },
                { session }
            );
        }
        if (stateIds.length > 0) {
            await State.updateMany(
                { _id: { $in: stateIds } },
                { $set: { systemID: system._id.toString() } },
                { session }
            );
        }
        if (groupIds.length > 0) {
            await Group.updateMany(
                { _id: { $in: groupIds } },
                { $set: { systemID: system._id.toString() } },
                { session }
            );
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