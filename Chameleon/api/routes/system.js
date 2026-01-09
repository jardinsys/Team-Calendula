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

// ===========================================
// GET SYSTEM
// ===========================================

/**
 * GET /api/system
 * Get current user's system (basic info)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'No system found', hasSystem: false });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found', hasSystem: false });
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
        const user = await User.findById(req.userId);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
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
        const user = await User.findById(req.userId);
        
        if (user.systemID) {
            return res.status(400).json({ error: 'You already have a system' });
        }
        
        const { name, description, sys_type } = req.body;
        
        const system = new System({
            users: [user._id],
            metadata: { joinedAt: new Date() },
            name: {
                display: name || 'My System',
                indexable: (name || 'My System').toLowerCase().replace(/[^a-z0-9]/g, '')
            },
            description,
            sys_type: sys_type || { 
                name: 'None',
                isSystem: false,
                isFragmented: false
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
// UPDATE SYSTEM
// ===========================================

/**
 * PATCH /api/system
 * Update system settings
 * Body: { name?, description?, sys_type?, color?, avatar?, ... }
 */
router.patch('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
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
                    system.name = {
                        display: updates[field],
                        indexable: updates[field].toLowerCase().replace(/[^a-z0-9]/g, ''),
                        closedNameDisplay: system.name?.closedNameDisplay
                    };
                } else if (field === 'name' && typeof updates[field] === 'object') {
                    system.name = {
                        ...system.name,
                        ...updates[field]
                    };
                    if (updates[field].display && !updates[field].indexable) {
                        system.name.indexable = updates[field].display.toLowerCase().replace(/[^a-z0-9]/g, '');
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
 * Body: { isSystem?, isFragmented?, name?, dd?: { DSM?, ICD? } }
 */
router.patch('/type', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }
        
        const { isSystem, isFragmented, name, dd } = req.body;
        
        system.sys_type = system.sys_type || {};
        
        if (isSystem !== undefined) system.sys_type.isSystem = isSystem;
        if (isFragmented !== undefined) system.sys_type.isFragmented = isFragmented;
        if (name !== undefined) system.sys_type.name = name;
        if (dd !== undefined) system.sys_type.dd = dd;
        
        await system.save();
        
        // Determine user type for response
        let userType = 'basic';
        if (system.sys_type.isSystem) {
            userType = 'system';
        } else if (system.sys_type.isFragmented) {
            userType = 'fractured';
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
        
        const user = await User.findById(req.userId);
        if (!user?.systemID) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
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

module.exports = router;
