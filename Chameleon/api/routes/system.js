// System Routes
// CRUD operations for system management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { convertAltersToStates, convertStatesToAlters } = require('../../discord_commands/functions/convert_functions');

// ===========================================
// GET SYSTEM
// ===========================================

/**
 * GET /api/system
 * Get current user's system (basic info)
 */
router.get('/', authMiddleware, async (req, res) => {
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
router.get('/full', authMiddleware, async (req, res) => {
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
router.post('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (user.systemID) {
            return res.status(400).json({ error: 'You already have a system' });
        }
        
        const { name, description, sys_type } = req.body;
        
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
            alters: { IDs: [] },
            states: { IDs: [] },
            groups: { IDs: [] }
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
router.post('/layers', authMiddleware, async (req, res) => {
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
        
        system.front.layers = newLayers;
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
router.patch('/', authMiddleware, async (req, res) => {
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
            'alterSynonym', 'timezone', 'birthday', 'theme'
        ];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                // Handle name specially to maintain indexable
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
router.patch('/type', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { isSystem, isFragmented, isDissociative, name, dd, onboardingCompleted } = req.body;
        
        system.sys_type = system.sys_type || {};
        
        if (isSystem !== undefined) system.sys_type.isSystem = isSystem;
        if (isFragmented !== undefined) system.sys_type.isFragmented = isFragmented;
        if (isDissociative !== undefined) system.sys_type.isDissociative = isDissociative;
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
 * Delete the user's system (requires confirmation)
 * Query: ?confirm=true
 */
router.delete('/', authMiddleware, async (req, res) => {
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
        
        // Delete all related entities
        await Promise.all([
            Alter.deleteMany({ _id: { $in: system.alters?.IDs || [] } }),
            State.deleteMany({ _id: { $in: system.states?.IDs || [] } }),
            Group.deleteMany({ _id: { $in: system.groups?.IDs || [] } })
        ]);
        
        // Delete the system
        await System.findByIdAndDelete(system._id);
        
        // Remove system reference from user
        user.systemID = null;
        await user.save();
        
        console.log(`[System] Deleted system ${system._id} for user ${user._id}`);
        
        res.json({ success: true, message: 'System deleted' });
    } catch (err) {
        console.error('[System] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CONVERT — alter ↔ state
// ===========================================

router.post('/convert', authMiddleware, async (req, res) => {
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

module.exports = router;
