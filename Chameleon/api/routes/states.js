// States Routes
// CRUD operations for state management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

// ===========================================
// GET ALL STATES
// ===========================================

/**
 * GET /api/states
 * Get all states for the current user's system
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const states = await State.find({ _id: { $in: system.states?.IDs || [] } })
            .select('_id name avatar color description groupIDs alters proxy metadata');
        
        res.json(states);
    } catch (err) {
        console.error('[States] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/states/summary
 * Get states with minimal data for dropdowns/selects
 */
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const states = await State.find({ _id: { $in: system.states?.IDs || [] } })
            .select('_id name avatar color');
        
        res.json(states.map(s => ({
            _id: s._id,
            name: s.name?.display || s.name?.indexable,
            avatar: s.avatar?.url,
            color: s.color
        })));
    } catch (err) {
        console.error('[States] Summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET SINGLE STATE
// ===========================================

/**
 * GET /api/states/:id
 * Get a single state by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // Verify state belongs to this system
        if (!system.states?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'State not found in your system' });
        }
        
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        res.json(state);
    } catch (err) {
        console.error('[States] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CREATE STATE
// ===========================================

/**
 * POST /api/states
 * Create a new state
 * Body: { name, description?, color?, avatar?, alters? }
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const { name, description, color, avatar, alters, signoff } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Check for duplicate name
        const existingStates = await State.find({ _id: { $in: system.states?.IDs || [] } });
        const duplicate = existingStates.find(s => 
            s.name?.indexable?.toLowerCase() === name.toLowerCase() ||
            s.name?.display?.toLowerCase() === name.toLowerCase()
        );
        
        if (duplicate) {
            return res.status(400).json({ error: `A state named "${name}" already exists` });
        }
        
        const state = new State({
            systemID: system._id,
            name: {
                display: name,
                indexable: name.toLowerCase().replace(/[^a-z0-9]/g, '')
            },
            description,
            color,
            avatar,
            alters: alters || [],
            signoff,
            genesisDate: new Date(),
            addedAt: new Date(),
            metadata: { addedAt: new Date() }
        });
        
        await state.save();
        
        // Add to system
        system.states = system.states || { IDs: [] };
        system.states.IDs.push(state._id);
        await system.save();
        
        console.log(`[States] Created state ${state._id} for system ${system._id}`);
        
        res.status(201).json(state);
    } catch (err) {
        console.error('[States] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE STATE
// ===========================================

/**
 * PATCH /api/states/:id
 * Update a state
 * Body: { name?, description?, color?, avatar?, alters?, ... }
 */
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // Verify state belongs to this system
        if (!system.states?.IDs?.includes(req.params.id)) {
            return res.status(403).json({ error: 'State not found in your system' });
        }
        
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        const updates = req.body;
        
        // Handle name update specially
        if (updates.name !== undefined) {
            if (typeof updates.name === 'string') {
                state.name = {
                    display: updates.name,
                    indexable: updates.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    closedNameDisplay: state.name?.closedNameDisplay,
                    aliases: state.name?.aliases
                };
            } else if (typeof updates.name === 'object') {
                state.name = { ...state.name, ...updates.name };
                if (updates.name.display && !updates.name.indexable) {
                    state.name.indexable = updates.name.display.toLowerCase().replace(/[^a-z0-9]/g, '');
                }
            }
        }
        
        // Allowed fields for direct update
        const allowedFields = [
            'description', 'color', 'avatar', 'signoff', 'alters',
            'groupIDs', 'proxy', 'discord', 'mask', 'caution'
        ];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                state[field] = updates[field];
            }
        }
        
        await state.save();
        
        res.json(state);
    } catch (err) {
        console.error('[States] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE STATE
// ===========================================

/**
 * DELETE /api/states/:id
 * Delete a state
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // Verify state belongs to this system
        if (!system.states?.IDs?.includes(req.params.id)) {
            return res.status(403).json({ error: 'State not found in your system' });
        }
        
        // Delete the state
        await State.findByIdAndDelete(req.params.id);
        
        // Remove from system
        system.states.IDs = system.states.IDs.filter(id => id !== req.params.id);
        await system.save();
        
        // Remove from any groups
        await Group.updateMany(
            { stateIDs: req.params.id },
            { $pull: { stateIDs: req.params.id } }
        );
        
        console.log(`[States] Deleted state ${req.params.id}`);
        
        res.json({ success: true, message: 'State deleted' });
    } catch (err) {
        console.error('[States] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// STATE PROXIES
// ===========================================

/**
 * POST /api/states/:id/proxy
 * Add a proxy tag to a state
 * Body: { proxy: "text" }
 */
router.post('/:id/proxy', authMiddleware, async (req, res) => {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        const { proxy } = req.body;
        if (!proxy || !proxy.includes('text')) {
            return res.status(400).json({ error: 'Proxy must contain "text" placeholder' });
        }
        
        state.proxy = state.proxy || [];
        if (!state.proxy.includes(proxy)) {
            state.proxy.push(proxy);
        }
        
        await state.save();
        
        res.json({ success: true, proxies: state.proxy });
    } catch (err) {
        console.error('[States] Add proxy error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/states/:id/proxy
 * Remove a proxy tag from a state
 * Body: { proxy: "text" }
 */
router.delete('/:id/proxy', authMiddleware, async (req, res) => {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        const { proxy } = req.body;
        state.proxy = (state.proxy || []).filter(p => p !== proxy);
        
        await state.save();
        
        res.json({ success: true, proxies: state.proxy });
    } catch (err) {
        console.error('[States] Remove proxy error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// LINK/UNLINK ALTERS
// ===========================================

/**
 * POST /api/states/:id/alters
 * Link alters to a state
 * Body: { alterIds: ["id1", "id2"] }
 */
router.post('/:id/alters', authMiddleware, async (req, res) => {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        const { alterIds } = req.body;
        if (!Array.isArray(alterIds)) {
            return res.status(400).json({ error: 'alterIds must be an array' });
        }
        
        state.alters = state.alters || [];
        for (const alterId of alterIds) {
            if (!state.alters.includes(alterId)) {
                state.alters.push(alterId);
            }
        }
        
        await state.save();
        
        res.json({ success: true, alters: state.alters });
    } catch (err) {
        console.error('[States] Link alters error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/states/:id/alters/:alterId
 * Unlink an alter from a state
 */
router.delete('/:id/alters/:alterId', authMiddleware, async (req, res) => {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        state.alters = (state.alters || []).filter(id => id !== req.params.alterId);
        await state.save();
        
        res.json({ success: true, alters: state.alters });
    } catch (err) {
        console.error('[States] Unlink alter error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
