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

// ===========================================
// CREATE SYSTEM
// ===========================================

/**
 * POST /api/system
 * Create a new system for the user
 * Body: { name, description?, sys_type? }
 */
router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (user.systemID) {
            return res.status(400).json({ error: 'You already have a system' });
        }
        
        const { name, description, sys_type } = req.body;
        
        // Create privacy buckets
        const strangersBucket = new PrivacyBucket({ name: 'Strangers', friends: [] });
        const friendsBucket = new PrivacyBucket({ name: 'Friends', friends: [] });
        await strangersBucket.save();
        await friendsBucket.save();

        // Seed default conditions based on system type
        const alterConditions = [];
        const stateConditions = [];
        if (sys_type?.isSystem) {
            alterConditions.push({ name: 'Dormant', settings: { hide_to_self: false, include_in_Count: true } });
        }
        if (sys_type?.isFragmented) {
            stateConditions.push({ name: 'Remission', settings: { hide_to_self: false, include_in_Count: true } });
        }
        
        const sysIdx = (name || 'My System').toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
        const system = new System({
            users: [user._id],
            metadata: { joinedAt: new Date() },
            name: {
                display: name || 'My System',
                ...(sysIdx && { indexable: sysIdx })
            },
            description,
            sys_type: sys_type || {
                name: 'None',
                dd: {},
                isSystem: false,
                isFragmented: false,
                isDissociative: false,
                onboardingCompleted: false
            },
            privacyBuckets: [strangersBucket._id, friendsBucket._id],
            alters: { conditions: alterConditions, IDs: [] },
            states: { conditions: stateConditions, IDs: [] },
            groups: { conditions: [], IDs: [] },
            setting: {
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
            }
        });
        
        await system.save();
        
        user.systemID = system._id;
        await user.save();
        
        console.log(`[System] Created new system for user ${user._id}`);
        
        res.status(201).json(system);
    } catch (err) {
        console.error('[System] Create error:', err);
        res.status(500).json({ error: err.message });
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

module.exports = router;
