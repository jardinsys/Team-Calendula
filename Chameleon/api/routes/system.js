// System Routes
// CRUD operations for system management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { convertAltersToStates, convertStatesToAlters } = require('../../discord_commands/functions/convert_functions');
const { PrivacyBucket } = require('../../schemas/settings');
const { mergePrivacySettings, getBucketTemplate } = require('../../schemas/settings');
const { uploadMiddleware } = require('../middleware/upload');
const { handleSystemImageUpload, handleSystemImageDelete } = require('./avatar');
const { deleteEntityR2Media, cleanUserReferences, deleteUserNotes, deleteUserMessages, deleteSystemData } = require('../utils/cascade');

// ===========================================
// GET SYSTEM
// ===========================================

/**
 * GET /api/system
 * Get current user's system (basic info)
 */
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered', hasSystem: false });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered', hasSystem: false });
        }
        
        res.json(system);
    } catch (err) {
        console.error('[System] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/system/full
 * Get system with entity counts and stats
 */
router.get('/full', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        // Get entity counts
        const [altersCount, statesCount, groupsCount] = await Promise.all([
            Alter.countDocuments({ _id: { $in: system.alters?.IDs || [] } }),
            State.countDocuments({ _id: { $in: system.states?.IDs || [] } }),
            Group.countDocuments({ _id: { $in: system.groups?.IDs || [] } })
        ]);
        
        res.json({
            ...system.toObject(),
            counts: {
                alters: altersCount,
                states: statesCount,
                groups: groupsCount
            }
        });
    } catch (err) {
        console.error('[System] Get full error:', err);
        res.status(500).json({ error: err.message });
    }
});

const { createSystemFromPayload } = require('../utils/createSystemFromPayload');

// ===========================================
// CREATE SYSTEM (staged payload support)
// ===========================================

/**
 * POST /api/system
 * Create a new system for the user
 * 
 * Simple mode (backward compatible):
 *   Body: { name, description?, sys_type? }
 * 
 * Staged mode (from useSystemSession / BotSessionManager):
 *   Body: {
 *     name: { display, indexable? },
 *     description?,
 *     sys_type: { name, dd?, isSystem, isFragmented, isDissociative, dissociativeStateName?, onboardingCompleted },
 *     privacyBuckets: [{ name, friends[] }] | [bucketId],
 *     alters: { conditions: [{name, settings}], IDs: [entityId] },
 *     states: { conditions: [{name, settings}], IDs: [entityId] },
 *     groups: { conditions: [{name, settings}], IDs: [entityId] },
 *     setting: { friendAutoBucket, privacy: [{ bucket, settings }] },
 *     front: { status, caution, layers: [{ _id, name, color, shifts }] }
 *   }
 */
router.post('/', async (req, res) => {
    try {
        const { system, user } = await createSystemFromPayload(req.user._id, req.body);
        res.status(201).json(system);
    } catch (err) {
        console.error('[System] Create error:', err);
        const status = err.message === 'You already have a system' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// ===========================================
// CREATE SYSTEM LAYERS
// ===========================================

/**
 * POST /api/system/layers
 * Create preset layers for a system
 * Body: { layers: [{ name, color }] }
 */
router.post('/layers', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { layers } = req.body;
        
        if (!Array.isArray(layers) || layers.length === 0) {
            return res.status(400).json({ error: 'layers array is required' });
        }
        
        // Initialize front.layers if not present
        if (!system.front) system.front = {};
        if (!system.front.layers) system.front.layers = [];
        
        // Create layers with ObjectId
        const newLayers = layers.map(layer => ({
            _id: new mongoose.Types.ObjectId(),
            name: layer.name,
            color: layer.color || '#8b5cf6',
            shifts: [],
        }));
        
        system.front.layers.push(...newLayers);
        await system.save();
        
        console.log(`[System] Created ${newLayers.length} preset layers for system ${system._id}`);
        
        res.status(201).json({ layers: system.front.layers });
    } catch (err) {
        console.error('[System] Create layers error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE SYSTEM
// ===========================================

/**
 * PATCH /api/system
 * Update system settings
 * Body: { name?, description?, sys_type?, color?, avatar?, ... }
 */
router.patch('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const updates = req.body;
        
        // Allowed fields for update
        const allowedFields = [
            'name', 'description', 'sys_type', 'color', 'avatar',
            'alterSynonym', 'timezone', 'birthday', 'theme',
            'proxy', 'setting', 'syncWithApps', 'front'
        ];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'name' && typeof updates[field] === 'string') {
                    const sysUpIdx = updates[field].toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                    system.name = {
                        display: updates[field],
                        ...(sysUpIdx && { indexable: sysUpIdx }),
                        closedNameDisplay: system.name?.closedNameDisplay
                    };
                } else if (field === 'name' && typeof updates[field] === 'object') {
                    system.name = {
                        ...system.name,
                        ...updates[field]
                    };
                    if (updates[field].display && !updates[field].indexable) {
                        const autoIdx = updates[field].display.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                        if (autoIdx) system.name.indexable = autoIdx;
                    }
                } else if (field === 'proxy') {
                    const allowedProxyFields = ['style', 'replyStyle', 'cooldown', 'break', 'caseSensitive'];
                    system.proxy = system.proxy || {};
                    for (const pf of allowedProxyFields) {
                        if (updates.proxy[pf] !== undefined) {
                            system.proxy[pf] = updates.proxy[pf];
                        }
                    }
                    // Also write to setting.proxyCoolDown for prefix command compatibility
                    if (updates.proxy.cooldown !== undefined) {
                        system.setting = system.setting || {};
                        system.setting.proxyCoolDown = updates.proxy.cooldown;
                    }
                } else if (field === 'setting') {
                    system.setting = system.setting || {};
                    if (updates.setting.closedCharAllowed !== undefined) {
                        system.setting.closedCharAllowed = updates.setting.closedCharAllowed;
                    }
                    if (updates.setting.autoshareNotestoUsers !== undefined) {
                        system.setting.autoshareNotestoUsers = updates.setting.autoshareNotestoUsers;
                    }
                    if (updates.setting.proxyCoolDown !== undefined) {
                        system.setting.proxyCoolDown = updates.setting.proxyCoolDown;
                    }
                } else if (field === 'syncWithApps') {
                    if (updates.syncWithApps.discord !== undefined) {
                        system.syncWithApps = system.syncWithApps || {};
                        system.syncWithApps.discord = updates.syncWithApps.discord;
                    }
                } else if (field === 'front') {
                    system.front = system.front || {};
                    if (updates.front.status !== undefined) {
                        system.front.status = updates.front.status;
                    }
                } else {
                    system[field] = updates[field];
                }
            }
        }
        
        await system.save();
        
        res.json(system);
    } catch (err) {
        console.error('[System] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// SYSTEM TYPE UPDATE
// ===========================================

/**
 * PATCH /api/system/type
 * Update system type (affects UI features available)
 * Body: { isSystem?, isFragmented?, isDissociative?, name?, dd?: { DSM?, ICD? }, onboardingCompleted? }
 */
router.patch('/type', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { isSystem, isFragmented, isDissociative, dissociativeStateName, name, dd, onboardingCompleted } = req.body;
        
        system.sys_type = system.sys_type || {};
        
        if (isSystem !== undefined) system.sys_type.isSystem = isSystem;
        if (isFragmented !== undefined) system.sys_type.isFragmented = isFragmented;
        if (isDissociative !== undefined) system.sys_type.isDissociative = isDissociative;
        if (dissociativeStateName !== undefined) system.sys_type.dissociativeStateName = dissociativeStateName;
        if (name !== undefined) system.sys_type.name = name;
        if (dd !== undefined) system.sys_type.dd = dd;
        if (onboardingCompleted !== undefined) system.sys_type.onboardingCompleted = onboardingCompleted;
        
        await system.save();
        
        // Determine user type for response
        let userType = 'basic';
        if (system.sys_type.isSystem) {
            userType = 'system';
        } else if (system.sys_type.isFragmented) {
            userType = 'fractured';
        } else if (system.sys_type.isDissociative) {
            userType = 'dissociative';
        }
        
        res.json({ 
            success: true, 
            sys_type: system.sys_type,
            userType
        });
    } catch (err) {
        console.error('[System] Type update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE SYSTEM
// ===========================================

/**
 * DELETE /api/system
 * Delete system with full cascade.
 * - Last user: deletes everything (entities, shifts, buckets, R2, Redis, notes, messages, user refs, guild refs, system doc)
 * - Non-last user: removes self from system, cleans up personal data, system stays for other users
 * Query: ?confirm=true
 * Body: { systemName: string }
 */
router.delete('/', async (req, res) => {
    try {
        if (req.query.confirm !== 'true') {
            return res.status(400).json({ 
                error: 'Confirmation required',
                message: 'Add ?confirm=true to confirm deletion'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        // Verify system name
        const systemName = req.body.systemName;
        if (!systemName) {
            return res.status(400).json({ error: 'Confirmation name required', message: 'Type your system name or username to confirm deletion' });
        }
        const systemDisplayName = system.name?.display?.toLowerCase() || '';
        const systemIndexable = system.name?.indexable?.toLowerCase() || '';
        const inputName = systemName.toLowerCase().trim();
        if (inputName !== systemDisplayName && inputName !== systemIndexable) {
            return res.status(400).json({ error: 'Name does not match', message: 'The name you entered does not match your system name.' });
        }

        // Determine if this user is the last in the system
        const otherUsers = system.users.filter(uid => uid.toString() !== user._id.toString());

        if (otherUsers.length === 0) {
            // Single user or last user: full cascade
            await deleteSystemData(system);
            await System.findByIdAndDelete(system._id);

            console.log(`[System] Deleted system ${system._id} (full cascade) and user ${user._id}`);
        } else {
            // Multi-user system: only remove this user
            system.users = otherUsers;
            await system.save();

            console.log(`[System] Removed user ${user._id} from multi-user system ${system._id}`);
        }

        // Clean up this user's personal data
        await deleteUserNotes(user._id);
        await deleteUserMessages(user.discordID);
        await cleanUserReferences(user._id, user.discordID, user.friendID);

        // Clean up guild references
        const Guild = require('../../schemas/guild');
        await Guild.updateMany(
            { userIDs: user.discordID },
            { $pull: { userIDs: user.discordID } }
        );
        await Guild.updateMany(
            { 'admins.memberIDs': user.discordID },
            { $pull: { 'admins.memberIDs': user.discordID } }
        );

        // Delete the user document
        await User.findByIdAndDelete(user._id);

        res.json({ success: true, message: 'System deleted' });
    } catch (err) {
        console.error('[System] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CONVERT — alter ↔ state
// ===========================================

router.post('/convert', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { type, names, target, keepOriginal } = req.body;

        if (!type || !names || !target) {
            return res.status(400).json({ error: 'Missing required fields: type, names, target' });
        }

        if (!['alter', 'state'].includes(type) || !['alter', 'state'].includes(target)) {
            return res.status(400).json({ error: 'Invalid type or target. Must be "alter" or "state".' });
        }

        if (type === target) {
            return res.status(400).json({ error: 'Source and target types are the same.' });
        }

        if (!Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ error: 'names must be a non-empty array' });
        }

        const options = { confirm: true, keep: keepOriginal || false };

        const convertFn = type === 'alter' ? convertAltersToStates : convertStatesToAlters;
        const { error, results } = await convertFn(system, names, options);

        if (error) {
            return res.status(404).json({ error, results });
        }

        res.json({ success: true, results });
    } catch (err) {
        console.error('[System] Convert error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// SYSTEM IMAGE UPLOADS
// ===========================================

router.post('/avatar', uploadMiddleware('file'), async (req, res, next) => {
    try { await handleSystemImageUpload(req, res, 'avatar'); } catch (err) { next(err); }
});
router.post('/banner', uploadMiddleware('file'), async (req, res, next) => {
    try { await handleSystemImageUpload(req, res, 'theme.background.media'); } catch (err) { next(err); }
});
router.delete('/avatar', async (req, res, next) => {
    try { await handleSystemImageDelete(req, res, 'avatar'); } catch (err) { next(err); }
});
router.delete('/banner', async (req, res, next) => {
    try { await handleSystemImageDelete(req, res, 'theme.background.media'); } catch (err) { next(err); }
});

// ===========================================
// PRIVACY BUCKET ROUTES
// ===========================================

/**
 * GET /api/system/privacy-buckets
 * Get all privacy buckets for the system with template info
 */
router.get('/privacy-buckets', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

        const system = await System.findById(user.systemID).populate('privacyBuckets');
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const buckets = system.privacyBuckets || [];
        const settings = system.setting?.privacy || [];

        // Merge bucket metadata with settings and template info
        const result = buckets.map(bucket => {
            const setting = settings.find(s => s.bucket === bucket.name);
            const template = getBucketTemplate(bucket.name, 'alter'); // Use alter as reference
            return {
                _id: bucket._id,
                name: bucket.name,
                friends: bucket.friends,
                settings: setting?.settings || {},
                template: template || null,
                isDefault: ['Strangers', 'Friends'].includes(bucket.name)
            };
        });

        res.json(result);
    } catch (err) {
        console.error('[PrivacyBuckets] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/system/privacy-buckets
 * Create a new privacy bucket
 * Body: { name: string, template?: 'Strangers' | 'Friends' | 'custom', settings?: object }
 */
router.post('/privacy-buckets', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

        const system = await System.findById(user.systemID);
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { name, template = 'Friends', settings: customSettings } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Bucket name is required' });
        }

        // Check for duplicate name (case-insensitive)
        const existing = system.privacyBuckets?.find(b => b.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: 'Bucket with this name already exists' });
        }

        // Merge template with custom settings
        const templateSettings = getBucketTemplate(template, 'alter') || getBucketTemplate('Friends', 'alter');
        const finalSettings = { ...templateSettings, ...customSettings };

        // Create PrivacyBucket doc
        const bucket = new PrivacyBucket({ name, friends: [] });
        await bucket.save();

        // Add to system
        system.privacyBuckets = system.privacyBuckets || [];
        system.privacyBuckets.push(bucket._id);

        // Add to system settings privacy array
        system.setting = system.setting || {};
        system.setting.privacy = system.setting.privacy || [];
        system.setting.privacy.push({ bucket: name, settings: finalSettings });

        await system.save();

        // TODO: Propagate to all existing entities (alter/state/group)
        // This could be a separate endpoint or done here

        res.status(201).json({
            _id: bucket._id,
            name: bucket.name,
            friends: bucket.friends,
            settings: finalSettings,
            template: templateSettings
        });
    } catch (err) {
        console.error('[PrivacyBuckets] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/system/privacy-buckets/:bucketId
 * Update a privacy bucket's settings
 * Body: { name?: string, settings?: object }
 */
router.patch('/privacy-buckets/:bucketId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

        const system = await System.findById(user.systemID).populate('privacyBuckets');
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { name, settings } = req.body;
        const bucketId = req.params.bucketId;

        // Find bucket in system
        const bucket = system.privacyBuckets?.find(b => b._id.toString() === bucketId);
        if (!bucket) {
            return res.status(404).json({ error: 'Privacy bucket not found in system' });
        }

        // Prevent renaming default buckets
        if (name && name !== bucket.name && ['Strangers', 'Friends'].includes(bucket.name)) {
            return res.status(400).json({ error: 'Cannot rename default buckets (Strangers, Friends)' });
        }

        // Update bucket name if provided
        if (name && name !== bucket.name) {
            // Check for duplicate
            const exists = system.privacyBuckets?.find(b => b.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                return res.status(400).json({ error: 'Bucket with this name already exists' });
            }
            bucket.name = name;
            await bucket.save();
        }

        // Update settings in system.setting.privacy
        if (settings) {
            system.setting = system.setting || {};
            system.setting.privacy = system.setting.privacy || [];
            const settingEntry = system.setting.privacy.find(s => s.bucket === (name || bucket.name));
            if (settingEntry) {
                settingEntry.settings = { ...settingEntry.settings, ...settings };
                if (name && name !== bucket.name) {
                    settingEntry.bucket = name;
                }
            }
        }

        await system.save();

        // TODO: Propagate settings changes to entities that use this bucket
        // This could be a separate endpoint

        res.json({
            _id: bucket._id,
            name: bucket.name,
            friends: bucket.friends,
            settings: settings || system.setting.privacy.find(s => s.bucket === (name || bucket.name))?.settings
        });
    } catch (err) {
        console.error('[PrivacyBuckets] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/system/privacy-buckets/:bucketId
 * Delete a privacy bucket (cannot delete Strangers or Friends)
 */
router.delete('/privacy-buckets/:bucketId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

        const system = await System.findById(user.systemID);
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const bucketId = req.params.bucketId;

        // Find bucket in system
        const bucketIndex = system.privacyBuckets?.findIndex(b => b._id.toString() === bucketId);
        if (bucketIndex === -1) {
            return res.status(404).json({ error: 'Privacy bucket not found in system' });
        }

        const bucket = await PrivacyBucket.findById(bucketId);
        if (!bucket) {
            return res.status(404).json({ error: 'Privacy bucket not found' });
        }

        // Prevent deleting default buckets
        if (['Strangers', 'Friends'].includes(bucket.name)) {
            return res.status(400).json({ error: 'Cannot delete default buckets (Strangers, Friends)' });
        }

        // Remove from system
        system.privacyBuckets.splice(bucketIndex, 1);

        // Remove from settings
        if (system.setting?.privacy) {
            system.setting.privacy = system.setting.privacy.filter(s => s.bucket !== bucket.name);
        }

        await system.save();
        await PrivacyBucket.findByIdAndDelete(bucketId);

        // TODO: Clean up entities still referencing this bucket
        // - Remove from entity.setting.privacy arrays
        // - Reassign friends from this bucket to friendAutoBucket

        res.json({ success: true, message: 'Privacy bucket deleted' });
    } catch (err) {
        console.error('[PrivacyBuckets] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/system/privacy-buckets/:bucketId/propagate
 * Propagate bucket settings to all entities using this bucket
 * Body: { entityTypes?: ['alter', 'state', 'group'], override?: boolean }
 */
router.post('/privacy-buckets/:bucketId/propagate', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

        const system = await System.findById(user.systemID).populate('privacyBuckets');
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { entityTypes = ['alter', 'state', 'group'], override = false } = req.body;
        const bucketId = req.params.bucketId;

        // Find bucket
        const bucket = system.privacyBuckets?.find(b => b._id.toString() === bucketId);
        if (!bucket) {
            return res.status(404).json({ error: 'Privacy bucket not found in system' });
        }

        // Get bucket settings
        const settingEntry = system.setting?.privacy?.find(s => s.bucket === bucket.name);
        if (!settingEntry) {
            return res.status(400).json({ error: 'Bucket settings not found in system' });
        }

        const bucketSettings = settingEntry.settings;
        let updatedCount = { alters: 0, states: 0, groups: 0 };

        const entityTypeMap = { alter: Alter, state: State, group: Group };
        const entityTypeKeyMap = { alter: 'alters', state: 'states', group: 'groups' };

        for (const entityType of entityTypes) {
            const Model = entityTypeMap[entityType];
            const key = entityTypeKeyMap[entityType];
            const entityIds = system[key]?.IDs || [];

            for (const entityId of entityIds) {
                const entity = await Model.findById(entityId);
                if (!entity) continue;

                entity.setting = entity.setting || {};
                entity.setting.privacy = entity.setting.privacy || [];

                const existingIdx = entity.setting.privacy.findIndex(p => p.bucket === bucket.name);

                if (existingIdx >= 0) {
                    if (override) {
                        entity.setting.privacy[existingIdx].settings = bucketSettings;
                        await entity.save();
                        updatedCount[`${entityType}s`]++;
                    }
                } else {
                    // Add new bucket entry for this entity
                    entity.setting.privacy.push({ bucket: bucket.name, settings: bucketSettings });
                    await entity.save();
                    updatedCount[`${entityType}s`]++;
                }
            }
        }

        console.log(`[PrivacyBuckets] Propagated ${bucket.name}:`, updatedCount);

        res.json({ success: true, updated: updatedCount });
    } catch (err) {
        console.error('[PrivacyBuckets] Propagate error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
