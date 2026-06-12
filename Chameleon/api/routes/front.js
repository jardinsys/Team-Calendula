// Front Routes
// View and manage front/switch status

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { optionalAuthMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');
const { resolveAlterDisplay } = require('../../discord_commands/functions/bot_utils');

// ===========================================
// GET CURRENT FRONT
// ===========================================

/**
 * GET /api/front
 * Get current front status for the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// SWITCH HISTORY
// ===========================================

/**
 * GET /api/front/history
 * Get switch history
 * Query: ?limit=10&before=timestamp
 */
router.get('/history', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { limit = 20, before } = req.query;
        
        // Collect all shift IDs from all layers
        const allShiftIds = [];
        for (const layer of system.front?.layers || []) {
            allShiftIds.push(...(layer.shifts || []));
        }
        
        // Build query
        let query = { _id: { $in: allShiftIds } };
        if (before) {
            query.startTime = { $lt: new Date(before) };
        }
        
        const shifts = await Shift.find(query)
            .sort({ startTime: -1 })
            .limit(parseInt(limit));
        
        // Enrich shifts with entity data
        const enrichedShifts = [];
        for (const shift of shifts) {
            let entity = null;
            
            if (shift.s_type === 'alter') {
                entity = await Alter.findById(shift.ID).select('_id name avatar color');
            } else if (shift.s_type === 'state') {
                entity = await State.findById(shift.ID).select('_id name avatar color');
            } else if (shift.s_type === 'group') {
                entity = await Group.findById(shift.ID).select('_id name avatar color');
            }
            
            enrichedShifts.push({
                _id: shift._id,
                type: shift.s_type,
                entityId: shift.ID,
                entityName: entity?.name?.display || entity?.name?.indexable || shift.type_name,
                avatar: entity?.avatar?.url,
                color: entity?.color,
                startTime: shift.startTime,
                endTime: shift.endTime,
                duration: shift.endTime 
                    ? shift.endTime - shift.startTime 
                    : Date.now() - shift.startTime,
                statuses: shift.statuses?.map(s => ({
                    status: s.status,
                    startTime: s.startTime,
                    endTime: s.endTime
                }))
            });
        }
        
        res.json({
            history: enrichedShifts,
            hasMore: shifts.length === parseInt(limit)
        });
    } catch (err) {
        console.error('[Front] History error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// LAYERS MANAGEMENT
// ===========================================

/**
 * GET /api/front/layers
 * Get all front layers
 */
router.get('/layers', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const layers = system.front?.layers || [];
        
        res.json(layers.map(layer => ({
            _id: layer._id,
            name: layer.name,
            color: layer.color,
            shiftCount: layer.shifts?.length || 0
        })));
    } catch (err) {
        console.error('[Front] Get layers error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE STATUS/BATTERY
// ===========================================

/**
 * PATCH /api/front/status
 * Update front status and/or social battery
 * Body: { status?, battery?, caution? }
 */
router.patch('/status', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { status, battery, caution } = req.body;
        
        if (!system.front) system.front = {};
        
        if (status !== undefined) {
            system.front.status = status;
        }
        
        if (caution !== undefined) {
            system.front.caution = caution;
        }
        
        if (battery !== undefined && !isNaN(battery)) {
            system.battery = Math.min(100, Math.max(0, parseInt(battery)));
        }
        
        await system.save();
        
        res.json({
            status: system.front.status,
            battery: system.battery,
            caution: system.front.caution
        });
    } catch (err) {
        console.error('[Front] Update status error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/front/:systemId
 * Get front status for a specific system (with privacy check)
 */
router.get('/:systemId', optionalAuthMiddleware, async (req, res) => {
    try {
        const system = await System.findById(req.params.systemId);
        
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }
        
        // Check if requester has access (is owner or friend)
        const isOwner = req.user?._id && system.users?.some(u => u.toString() === req.user?._id);
        
        // TODO: Add privacy bucket checking here
        // For now, return basic front info
        
        const frontData = await buildFrontData(system, !isOwner);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Get by ID error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/front/layers
 * Create a new front layer
 * Body: { name, color? }
 */
router.post('/layers', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { name, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Layer name is required' });
        }
        
        if (!system.front) system.front = {};
        if (!system.front.layers) system.front.layers = [];
        
        const newLayer = {
            _id: new mongoose.Types.ObjectId(),
            name,
            color,
            shifts: []
        };
        
        system.front.layers.push(newLayer);
        await system.save();
        
        res.status(201).json(newLayer);
    } catch (err) {
        console.error('[Front] Create layer error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/front/layers/:layerId
 * Delete a front layer (ends all shifts in it)
 */
router.delete('/layers/:layerId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const layerIndex = system.front?.layers?.findIndex(
            l => l._id.toString() === req.params.layerId
        );
        
        if (layerIndex === -1) {
            return res.status(404).json({ error: 'Layer not found' });
        }
        
        // Don't allow deleting the last layer
        if (system.front.layers.length <= 1) {
            return res.status(400).json({ error: 'Cannot delete the only layer' });
        }
        
        const layer = system.front.layers[layerIndex];
        
        // End all shifts in this layer
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) {
                shift.endTime = new Date();
                await shift.save();
            }
        }
        
        // Remove the layer
        system.front.layers.splice(layerIndex, 1);
        await system.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Front] Delete layer error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE SHIFT STATUS
// ===========================================

/**
 * PATCH /api/front/shift/:shiftId/status
 * Update the status/battery/caution of an active shift
 * Body: { status?, battery?, caution?, applyTo? }
 * applyTo: 'shift' | 'preset' | 'both' (default: 'shift')
 */
router.patch('/shift/:shiftId/status', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { status, battery, caution, applyTo = 'shift' } = req.body;
        const shift = await Shift.findById(req.params.shiftId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        if (shift.endTime) {
            return res.status(400).json({ error: 'Cannot update ended shift' });
        }

        const hasStatusChange = status !== undefined;
        const hasBatteryChange = battery !== undefined;
        const hasCautionChange = caution !== undefined;

        if (hasStatusChange || hasBatteryChange || hasCautionChange) {
            if (shift.statuses?.length > 0) {
                const lastStatus = shift.statuses[shift.statuses.length - 1];
                if (!lastStatus.endTime) {
                    lastStatus.endTime = new Date();
                }
            }

            shift.statuses = shift.statuses || [];
            const newEntry = {
                startTime: new Date(),
                hidden: 'n'
            };
            if (hasStatusChange) newEntry.status = status;
            if (hasBatteryChange) newEntry.battery = battery !== null && battery !== '' ? Number(battery) : null;
            if (hasCautionChange) newEntry.caution = caution || null;
            shift.statuses.push(newEntry);
        }

        await shift.save();

        if (applyTo === 'preset' || applyTo === 'both') {
            let entity = null;
            if (shift.s_type === 'alter') entity = await Alter.findById(shift.ID);
            else if (shift.s_type === 'state') entity = await State.findById(shift.ID);
            else if (shift.s_type === 'group') entity = await Group.findById(shift.ID);

            if (entity) {
                if (hasStatusChange && (applyTo === 'preset' || applyTo === 'both')) {
                    entity.setting = entity.setting || {};
                    entity.setting.default_status = status;
                }
                if (hasBatteryChange && (applyTo === 'preset' || applyTo === 'both')) {
                    entity.setting = entity.setting || {};
                    entity.setting.default_battery = battery !== null && battery !== '' ? Number(battery) : null;
                }
                if (hasCautionChange && (applyTo === 'preset' || applyTo === 'both')) {
                    entity.caution = caution || null;
                }
                await entity.save();
            }
        }

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Update shift status error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GUIDED SWITCH
// ===========================================

/**
 * POST /api/front/switch
 * Guided switch with multi-layer support
 * Body: {
 *   layers: [{ name?, color?, entities: [{ id, type }], groupId? }],
 *   status?: string,
 *   battery?: number
 * }
 */
router.post('/switch', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { layers: layerInputs, status, battery } = req.body;

        if (!Array.isArray(layerInputs) || layerInputs.length === 0) {
            return res.status(400).json({ error: 'At least one layer with entities is required' });
        }

        // Close all active shifts across all layers
        await closeAllActiveShifts(system);

        // Build new layers
        const newLayers = [];
        for (const layerInput of layerInputs) {
            const entities = layerInput.entities || [];
            if (entities.length === 0) continue;

            const layerId = new mongoose.Types.ObjectId();
            const layerObj = {
                _id: layerId,
                name: layerInput.name || `Layer ${newLayers.length + 1}`,
                color: layerInput.color || null,
                shifts: []
            };

            for (const ent of entities) {
                let entity = null;
                if (ent.type === 'alter') entity = await Alter.findById(ent.id);
                else if (ent.type === 'state') entity = await State.findById(ent.id);
                else if (ent.type === 'group') entity = await Group.findById(ent.id);

                if (!entity) continue;

                const shift = new Shift({
                    _id: new mongoose.Types.ObjectId(),
                    s_type: ent.type,
                    ID: ent.id,
                    type_name: entity.name?.display || entity.name?.indexable || 'Unknown',
                    startTime: new Date(),
                    endTime: null,
                    statuses: [{
                        status: entity.setting?.default_status || null,
                        battery: entity.setting?.default_battery || null,
                        caution: entity.caution || null,
                        startTime: new Date(),
                        endTime: null,
                        layerID: layerId,
                        hidden: 'n'
                    }]
                });
                await shift.save();
                layerObj.shifts.push(shift._id);

                // Update recent proxies
                await updateRecentProxies(system, entity, ent.type);
            }

            newLayers.push(layerObj);
        }

        system.front.layers = newLayers;

        if (status !== undefined) {
            system.front.status = status || null;
        }
        if (battery !== undefined && !isNaN(battery)) {
            system.battery = Math.min(100, Math.max(0, parseInt(battery)));
        }

        await system.save();

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Guided switch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// ADD/REMOVE INDIVIDUAL SHIFTS
// ===========================================

/**
 * POST /api/front/shift
 * Add a single entity to front
 * Body: { entityId, entityType, layerId?, parentShiftId? }
 */
router.post('/shift', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { entityId, entityType, layerId, parentShiftId } = req.body;

        if (!entityId || !entityType) {
            return res.status(400).json({ error: 'entityId and entityType are required' });
        }

        // Resolve entity
        let entity = null;
        if (entityType === 'alter') entity = await Alter.findById(entityId);
        else if (entityType === 'state') entity = await State.findById(entityId);
        else if (entityType === 'group') entity = await Group.findById(entityId);

        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        // Check if already fronting
        const existing = await findActiveShiftAsync(entityId, entityType, system);
        if (existing) {
            return res.status(400).json({ error: 'Entity is already fronting' });
        }

        if (!system.front) system.front = {};
        if (!system.front.layers || system.front.layers.length === 0) {
            system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
        }

        // Determine target layer
        let targetLayer;
        if (layerId) {
            targetLayer = system.front.layers.find(l => l._id.toString() === layerId);
        } else {
            targetLayer = system.front.layers[0]; // default to top layer
        }

        if (!targetLayer) {
            return res.status(404).json({ error: 'Layer not found' });
        }

        const shiftId = new mongoose.Types.ObjectId();
        const shift = new Shift({
            _id: shiftId,
            s_type: entityType,
            ID: entityId,
            type_name: entity.name?.display || entity.name?.indexable || 'Unknown',
            startTime: new Date(),
            endTime: null,
            parentShift: parentShiftId || null,
            statuses: [{
                status: entity.setting?.default_status || null,
                battery: entity.setting?.default_battery || null,
                caution: entity.caution || null,
                startTime: new Date(),
                endTime: null,
                layerID: targetLayer._id,
                hidden: 'n'
            }]
        });
        await shift.save();
        targetLayer.shifts.push(shiftId);

        // If adding as child of a group shift, update parent
        if (parentShiftId) {
            const parentShift = await Shift.findById(parentShiftId);
            if (parentShift) {
                parentShift.childShifts = parentShift.childShifts || [];
                parentShift.childShifts.push(shiftId);
                await parentShift.save();
            }
        }

        await updateRecentProxies(system, entity, entityType);
        await system.save();

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Add shift error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/front/shift/:shiftId
 * Remove a single entity from front (ends the shift)
 */
router.delete('/shift/:shiftId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const shift = await Shift.findById(req.params.shiftId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        if (shift.endTime) {
            return res.status(400).json({ error: 'Shift already ended' });
        }

        const now = new Date();
        shift.endTime = now;
        if (shift.statuses?.length > 0) {
            const lastStatus = shift.statuses[shift.statuses.length - 1];
            if (!lastStatus.endTime) {
                lastStatus.endTime = now;
            }
        }
        await shift.save();

        // Also end any child shifts
        for (const childId of shift.childShifts || []) {
            const child = await Shift.findById(childId);
            if (child && !child.endTime) {
                child.endTime = now;
                if (child.statuses?.length > 0) {
                    const last = child.statuses[child.statuses.length - 1];
                    if (!last.endTime) last.endTime = now;
                }
                await child.save();
            }
        }

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Remove shift error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// LAYER RENAME / REORDER
// ===========================================

/**
 * PATCH /api/front/layers/reorder
 * Reorder layers
 * Body: { layerIds: string[] }
 */
router.patch('/layers/reorder', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { layerIds } = req.body;

        if (!Array.isArray(layerIds) || layerIds.length === 0) {
            return res.status(400).json({ error: 'layerIds array is required' });
        }

        const currentLayers = system.front?.layers || [];
        const reordered = [];

        for (const id of layerIds) {
            const layer = currentLayers.find(l => l._id.toString() === id);
            if (layer) reordered.push(layer);
        }

        // Add any layers not in the provided IDs (safety net)
        for (const layer of currentLayers) {
            if (!reordered.find(l => l._id.toString() === layer._id.toString())) {
                reordered.push(layer);
            }
        }

        system.front.layers = reordered;
        await system.save();

        res.json({ success: true, layers: reordered.map(l => ({ _id: l._id, name: l.name })) });
    } catch (err) {
        console.error('[Front] Reorder layers error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/front/layers/:layerId
 * Rename a layer
 * Body: { name, color? }
 */
router.patch('/layers/:layerId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const layer = system.front?.layers?.find(
            l => l._id.toString() === req.params.layerId
        );

        if (!layer) {
            return res.status(404).json({ error: 'Layer not found' });
        }

        if (req.body.name !== undefined) {
            layer.name = req.body.name;
        }
        if (req.body.color !== undefined) {
            layer.color = req.body.color;
        }

        await system.save();

        res.json({ success: true, layer: { _id: layer._id, name: layer.name, color: layer.color } });
    } catch (err) {
        console.error('[Front] Rename layer error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CHILD SHIFTS (GROUP MEMBERS)
// ===========================================

/**
 * POST /api/front/shift/:shiftId/children
 * Add a child shift to a group shift
 * Body: { entityId, entityType }
 */
router.post('/shift/:shiftId/children', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const parentShift = await Shift.findById(req.params.shiftId);
        if (!parentShift) {
            return res.status(404).json({ error: 'Parent shift not found' });
        }
        if (parentShift.endTime) {
            return res.status(400).json({ error: 'Parent shift already ended' });
        }
        if (parentShift.s_type !== 'group') {
            return res.status(400).json({ error: 'Only group shifts can have children' });
        }

        const { entityId, entityType } = req.body;
        if (!entityId || !entityType) {
            return res.status(400).json({ error: 'entityId and entityType are required' });
        }

        let entity = null;
        if (entityType === 'alter') entity = await Alter.findById(entityId);
        else if (entityType === 'state') entity = await State.findById(entityId);

        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        // Find which layer the parent shift is in
        let parentLayerId = null;
        for (const layer of system.front?.layers || []) {
            if (layer.shifts.some(id => id.toString() === parentShift._id.toString())) {
                parentLayerId = layer._id;
                break;
            }
        }

        const childShift = new Shift({
            _id: new mongoose.Types.ObjectId(),
            s_type: entityType,
            ID: entityId,
            type_name: entity.name?.display || entity.name?.indexable || 'Unknown',
            startTime: new Date(),
            endTime: null,
            parentShift: parentShift._id,
            statuses: [{
                status: entity.setting?.default_status || null,
                battery: entity.setting?.default_battery || null,
                caution: entity.caution || null,
                startTime: new Date(),
                endTime: null,
                layerID: parentLayerId,
                hidden: 'n'
            }]
        });
        await childShift.save();

        parentShift.childShifts = parentShift.childShifts || [];
        parentShift.childShifts.push(childShift._id);
        await parentShift.save();

        await updateRecentProxies(system, entity, entityType);
        await system.save();

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Add child shift error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/front/shift/:shiftId/children/:childId
 * Remove a child shift from a group shift
 */
router.delete('/shift/:shiftId/children/:childId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const parentShift = await Shift.findById(req.params.shiftId);
        if (!parentShift) {
            return res.status(404).json({ error: 'Parent shift not found' });
        }

        const childShift = await Shift.findById(req.params.childId);
        if (!childShift) {
            return res.status(404).json({ error: 'Child shift not found' });
        }

        // End the child shift
        const now = new Date();
        childShift.endTime = now;
        if (childShift.statuses?.length > 0) {
            const last = childShift.statuses[childShift.statuses.length - 1];
            if (!last.endTime) last.endTime = now;
        }
        await childShift.save();

        // Remove from parent's childShifts
        parentShift.childShifts = (parentShift.childShifts || []).filter(
            id => id.toString() !== req.params.childId
        );
        await parentShift.save();

        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Remove child shift error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function closeAllActiveShifts(system) {
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) {
                shift.endTime = new Date();
                if (shift.statuses?.length > 0) {
                    const lastStatus = shift.statuses[shift.statuses.length - 1];
                    if (!lastStatus.endTime) {
                        lastStatus.endTime = new Date();
                    }
                }
                await shift.save();
            }
        }
    }
}

async function findActiveShiftAsync(entityId, entityType, system) {
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime && shift.ID === entityId && shift.s_type === entityType) {
                return shift;
            }
        }
    }
    return null;
}

async function updateRecentProxies(system, entity, entityType) {
    if (!system.proxy) system.proxy = {};
    if (!system.proxy.recentProxies) system.proxy.recentProxies = [];

    const entry = {
        type: entityType,
        id: entity._id.toString(),
        timestamp: Date.now()
    };

    // Remove existing entry for this entity
    system.proxy.recentProxies = system.proxy.recentProxies.filter(
        p => !(p.id === entry.id && p.type === entry.type)
    );

    // Add to front
    system.proxy.recentProxies.unshift(entry);

    // Cap at 15
    if (system.proxy.recentProxies.length > 15) {
        system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
    }
}

async function resolveEntityDisplay(entity, type, system, limited) {
    let displayName, avatarUrl, entityColor, pronouns;

    if (type === 'alter' && entity.activeStates?.all?.length > 0) {
        const resolved = await resolveAlterDisplay(entity, system);
        displayName = resolved.name || entity.name?.display || entity.name?.indexable;
        avatarUrl = resolved.avatar || entity.avatar?.url || entity.discord?.image?.avatar?.url;
        entityColor = resolved.color || entity.color;
        pronouns = limited ? undefined : (resolved.pronouns || entity.pronouns);
    } else {
        displayName = limited
            ? (entity.name?.closedNameDisplay || entity.name?.display || entity.name?.indexable)
            : (entity.name?.display || entity.name?.indexable);
        avatarUrl = entity.avatar?.url || entity.discord?.image?.avatar?.url;
        entityColor = entity.color;
        pronouns = limited ? undefined : entity.pronouns;
    }

    return { displayName, avatarUrl, entityColor, pronouns };
}

async function buildFrontData(system, limited = false) {
    const frontData = {
        status: system.front?.status,
        battery: system.battery,
        caution: system.front?.caution,
        layers: []
    };

    for (const layer of system.front?.layers || []) {
        const layerData = {
            _id: layer._id,
            name: layer.name,
            color: layer.color,
            fronters: []
        };

        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);

            // Only show active shifts (skip children — they're resolved via parent)
            if (!shift || shift.endTime) continue;
            if (shift.parentShift) continue;

            let entity = null;
            if (shift.s_type === 'alter') entity = await Alter.findById(shift.ID);
            else if (shift.s_type === 'state') entity = await State.findById(shift.ID);
            else if (shift.s_type === 'group') entity = await Group.findById(shift.ID);

            if (!entity) continue;

            const currentStatus = shift.statuses?.[shift.statuses.length - 1];
            const { displayName, avatarUrl, entityColor, pronouns } = await resolveEntityDisplay(entity, shift.s_type, system, limited);

            const fronter = {
                _id: entity._id,
                shiftId: shift._id,
                type: shift.s_type,
                name: displayName,
                avatar: avatarUrl,
                color: entityColor,
                pronouns,
                status: currentStatus?.status,
                battery: currentStatus?.battery,
                caution: currentStatus?.caution,
                startTime: shift.startTime,
                duration: Date.now() - new Date(shift.startTime).getTime()
            };

            // Resolve child shifts for group entities
            if (shift.s_type === 'group' && shift.childShifts?.length > 0) {
                fronter.children = [];
                for (const childId of shift.childShifts) {
                    const childShift = await Shift.findById(childId);
                    if (!childShift || childShift.endTime) continue;

                    let childEntity = null;
                    if (childShift.s_type === 'alter') childEntity = await Alter.findById(childShift.ID);
                    else if (childShift.s_type === 'state') childEntity = await State.findById(childShift.ID);

                    if (!childEntity) continue;

                    const childStatus = childShift.statuses?.[childShift.statuses.length - 1];
                    const childDisplay = await resolveEntityDisplay(childEntity, childShift.s_type, system, limited);

                    fronter.children.push({
                        _id: childEntity._id,
                        shiftId: childShift._id,
                        type: childShift.s_type,
                        name: childDisplay.displayName,
                        avatar: childDisplay.avatarUrl,
                        color: childDisplay.entityColor,
                        pronouns: childDisplay.pronouns,
                        status: childStatus?.status,
                        battery: childStatus?.battery,
                        caution: childStatus?.caution,
                        startTime: childShift.startTime,
                        duration: Date.now() - new Date(childShift.startTime).getTime()
                    });
                }
            }

            layerData.fronters.push(fronter);
        }

        if (layerData.fronters.length > 0 || !limited) {
            frontData.layers.push(layerData);
        }
    }

    return frontData;
}

module.exports = router;
