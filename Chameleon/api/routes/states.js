// States Routes
// CRUD operations for state management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();


const System = require('../../schemas/system');
const User = require('../../schemas/user');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Alter = require('../../schemas/alter');
const { checkProxyExists, createAndLinkEntity } = require('../../discord_commands/functions/bot_utils');
const { uploadMiddleware } = require('../middleware/upload');
const { handleEntityImageUpload, handleEntityImageDelete } = require('./avatar');

// ===========================================
// GET ALL STATES
// ===========================================

/**
 * GET /api/states
 * Get all states for the current user's system
 */
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const allIds = system.states?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            const pageIds = allIds.slice(s, s + l);
            const states = await State.find({ _id: { $in: pageIds } })
                .select('_id name avatar color description groupIDs alters proxy metadata');
            return res.json({ data: states, total, hasMore: s + l < total });
        }

        const states = await State.find({ _id: { $in: allIds } })
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
router.get('/summary', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const allIds = system.states?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;
        const ids = (skip !== undefined || limit !== undefined)
            ? allIds.slice(parseInt(skip, 10) || 0, (parseInt(skip, 10) || 0) + (parseInt(limit, 10) || 20))
            : allIds;

        const states = await State.find({ _id: { $in: ids } })
            .select('_id name avatar color');
        
        const mapped = states.map(s => ({
            _id: s._id,
            name: s.name?.display || s.name?.indexable,
            avatar: s.avatar?.url,
            color: s.color
        }));

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            return res.json({ data: mapped, total, hasMore: s + l < total });
        }
        res.json(mapped);
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
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
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
router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { name, description, color, avatar, alters, groupIDs, signoff } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Check for duplicate name
        const existingStates = await State.find({ _id: { $in: system.states?.IDs || [] } });
        const stIdx = name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
        const duplicate = stIdx ? existingStates.find(s => s.name?.indexable?.toLowerCase() === stIdx) : undefined;
        
        if (duplicate) {
            return res.status(400).json({ error: `A state named "${name}" already exists` });
        }
        
        const state = new State({
            name: {
                display: name,
                ...(stIdx && { indexable: stIdx })
            },
            description,
            color,
            avatar,
            alters: alters || [],
            groupIDs: groupIDs || [],
            signoff,
            syncWithApps: { discord: true },
            genesisDate: new Date(),
            addedAt: new Date(),
            metadata: { addedAt: new Date() }
        });
        
        await createAndLinkEntity(state, system, 'state');
        
        // Bidirectional alter linking
        if (alters?.length) {
            for (const alterId of alters) {
                const alter = await Alter.findById(alterId);
                if (alter && !alter.states?.some(s => s.connected_id === state._id.toString())) {
                    alter.states = alter.states || [];
                    alter.states.push({
                        connected_id: state._id.toString(),
                        name: { indexable: state.name?.indexable, display: state.name?.display }
                    });
                    await alter.save();
                }
            }
        }
        
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
router.patch('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
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
                const stUpIdx = updates.name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                state.name = {
                    display: updates.name,
                    ...(stUpIdx && { indexable: stUpIdx }),
                    closedNameDisplay: state.name?.closedNameDisplay,
                    aliases: state.name?.aliases
                };
            } else if (typeof updates.name === 'object') {
                state.name = { ...state.name, ...updates.name };
                if (updates.name.display && !updates.name.indexable) {
                    const autoIdx = updates.name.display.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                    if (autoIdx) state.name.indexable = autoIdx;
                }
            }
        }
        
        // Allowed fields for direct update
        const allowedFields = [
            'description', 'color', 'avatar', 'signoff', 'alters',
            'groupIDs', 'proxy', 'discord', 'mask', 'caution',
            'condition'
        ];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                state[field] = updates[field];
            }
        }

        if (updates.name?.aliases !== undefined) {
            state.name = state.name || {};
            state.name.aliases = updates.name.aliases;
        }
        if (updates.name?.closedNameDisplay !== undefined) {
            state.name = state.name || {};
            state.name.closedNameDisplay = updates.name.closedNameDisplay;
        }
        if (updates.setting && typeof updates.setting === 'object') {
            state.setting = state.setting || {};
            const allowedSettings = ['default_status', 'default_battery', 'allowPing'];
            for (const key of allowedSettings) {
                if (updates.setting[key] !== undefined) {
                    state.setting[key] = updates.setting[key];
                }
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
// STATE IMAGE UPLOADS
// ===========================================

router.post('/:id/avatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'state', 'avatar'); } catch (err) { next(err); } });
router.post('/:id/banner', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'state', 'discord.image.banner'); } catch (err) { next(err); } });
router.post('/:id/proxyAvatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'state', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });
router.delete('/:id/avatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'state', 'avatar'); } catch (err) { next(err); } });
router.delete('/:id/banner', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'state', 'discord.image.banner'); } catch (err) { next(err); } });
router.delete('/:id/proxyAvatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'state', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });

// ===========================================
// DELETE STATE
// ===========================================

/**
 * DELETE /api/states/:id
 * Delete a state
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
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
        
        // Clean up orphaned shifts in front layers
        const { Shift } = require('../../schemas/front');
        for (const layer of system.front?.layers || []) {
            const shiftsToRemove = [];
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && shift.ID === req.params.id && shift.s_type === 'state') {
                    await Shift.findByIdAndDelete(shiftId);
                    shiftsToRemove.push(shiftId);
                }
            }
            if (shiftsToRemove.length) {
                layer.shifts = layer.shifts.filter(s => !shiftsToRemove.includes(s.toString()));
            }
        }
        
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
router.post('/:id/proxy', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        if (!system.states?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'State not found' });
        }

        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        const { proxy } = req.body;
        if (!proxy || !proxy.includes('text')) {
            return res.status(400).json({ error: 'Proxy must contain "text" placeholder' });
        }

        const { exists, entity, type } = await checkProxyExists(proxy, system, state._id.toString());
        if (exists) {
            return res.status(409).json({ error: `Proxy is already used by ${type} "${entity.name?.display || entity.name?.indexable || 'Unknown'}"` });
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
router.delete('/:id/proxy', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.states?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'State not found' });
        }

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
router.post('/:id/alters', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.states?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'State not found' });
        }

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
        
        // Update reverse links on alters
        await Alter.updateMany(
            { _id: { $in: alterIds } },
            { $addToSet: { states: state._id.toString() } }
        );
        
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
router.delete('/:id/alters/:alterId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.states?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'State not found' });
        }

        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }
        
        state.alters = (state.alters || []).filter(id => id !== req.params.alterId);
        await state.save();
        
        // Update reverse link on alter
        await Alter.updateOne(
            { _id: req.params.alterId },
            { $pull: { states: state._id.toString() } }
        );
        
        res.json({ success: true, alters: state.alters });
    } catch (err) {
        console.error('[States] Unlink alter error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// BATCH OPERATIONS
// ===========================================

router.delete('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });

        const validIds = ids.filter(id => system.states?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid states found' });

        await Group.updateMany({ stateIDs: { $in: validIds } }, { $pull: { stateIDs: { $in: validIds } } });
        await State.deleteMany({ _id: { $in: validIds } });

        system.states.IDs = system.states.IDs.filter(id => !validIds.includes(id));
        await system.save();

        res.json({ success: true, deleted: validIds.length });
    } catch (err) {
        console.error('[States] Batch delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { ids, updates } = req.body;
        if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
        if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'updates object required' });

        const validIds = ids.filter(id => system.states?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid states found' });

        const allowedFields = ['condition', 'color', 'signoff', 'description', 'pronouns', 'proxy', 'caution'];
        const dbUpdates = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) dbUpdates[field] = updates[field];
        }
        if (updates.setting && typeof updates.setting === 'object') {
            const allowedSettings = ['default_status', 'default_battery', 'allowPing'];
            for (const key of allowedSettings) {
                if (updates.setting[key] !== undefined) {
                    dbUpdates[`setting.${key}`] = updates.setting[key];
                }
            }
        }

        if (Object.keys(dbUpdates).length === 0) return res.status(400).json({ error: 'No valid update fields' });

        const result = await State.updateMany({ _id: { $in: validIds } }, { $set: dbUpdates });
        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        console.error('[States] Batch update error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
