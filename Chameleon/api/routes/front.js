// Front Routes
// View and manage front/switch status

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { optionalAuthMiddleware } = require('../middleware/auth');
const { publishEvent } = require('../../redis');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');
const { resolveAlterDisplay, getPrivacyBucket, shouldShowEntity } = require('../../discord_commands/functions/bot_utils');

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
 * Get switch history with full status details
 * Query: ?limit=20&before=timestamp&from=ISO&to=ISO
 */
router.get('/history', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { limit = 100, before, from, to } = req.query;
        
        // Query ALL shifts for this system, not just current layer shifts
        let query = {};
        if (before) {
            query.startTime = { ...query.startTime, $lt: new Date(before) };
        }
        if (from || to) {
            query.startTime = query.startTime || {};
            if (from) query.startTime.$gte = new Date(from);
            if (to) query.startTime.$lte = new Date(to);
        }
        
        const shifts = await Shift.find(query)
            .sort({ startTime: -1 })
            .limit(isNaN(parseInt(limit)) ? 50 : Math.min(parseInt(limit), 100));
        
        // Build layer lookup for name resolution
        const layerMap = new Map();
        for (const layer of (system.front?.layers || [])) {
            layerMap.set(layer._id.toString(), layer.name);
        }
        
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
                    battery: s.battery,
                    caution: s.caution,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    layerID: s.layerID,
                    layerName: layerMap.get(s.layerID?.toString()) || null
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
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
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
        
        // Get viewer's privacy bucket for non-owners
        let privacyBucket = null;
        if (!isOwner && req.user?._id) {
            const viewerUser = await User.findById(req.user._id);
            if (viewerUser) {
                privacyBucket = getPrivacyBucket(system, viewerUser.discordID, viewerUser.friendID);
            }
        }
        
        // Check system-level privacy
        if (!isOwner) {
            const systemPrivacy = system.setting?.privacy?.find(p => p.bucket === privacyBucket?.name);
            if (systemPrivacy?.settings?.hidden === true) {
                return res.status(403).json({ error: 'This system is hidden' });
            }
        }
        
        const frontData = await buildFrontData(system, !isOwner, privacyBucket);
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
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
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
                // Clear stale layerID references in statuses
                for (const status of shift.statuses || []) {
                    status.layerID = undefined;
                }
                await shift.save();
            }
        }
        
        // Remove the layer
        system.front.layers.splice(layerIndex, 1);
        await system.save();
        
        res.json({ success: true });
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
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

        // Verify the shift belongs to an entity in this system
        const entityIds = system[`${shift.s_type}s`]?.IDs || [];
        if (!entityIds.some(id => id.toString() === shift.ID)) {
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
                hidden: 'n',
                layerID: shift.statuses?.[0]?.layerID
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

        // Verify all entities belong to this system
        for (const layer of layerInputs) {
            for (const entityInfo of layer.entities || []) {
                const ids = system[`${entityInfo.type}s`]?.IDs || [];
                if (!ids.some(id => id.toString() === entityInfo.id)) {
                    return res.status(404).json({ error: `${entityInfo.type} not found` });
                }
            }
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
                    shiftId: new mongoose.Types.ObjectId(),
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

        // NOTE: Friend switch notifications are not fired here because the API
        // doesn't have access to the Discord client. Notifications fire from
        // Discord switches (guided + quick) in slash/front.js.
        // TODO: Add Redis pub/sub to trigger notifications from API switches.

        const frontData = await buildFrontData(system);
        res.json(frontData);
        publishEvent(system._id.toString(), { type: 'front:switch', systemId: system._id.toString() });
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

        // Verify the entity belongs to this system
        const ids = system[`${entityType}s`]?.IDs || [];
        if (!ids.some(id => id.toString() === entityId)) {
            return res.status(404).json({ error: `${entityType} not found` });
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
            shiftId: shiftId,
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
        publishEvent(system._id.toString(), { type: 'front:switch', systemId: system._id.toString() });
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

        // Verify the shift belongs to an entity in this system
        const entityIds = system[`${shift.s_type}s`]?.IDs || [];
        if (!entityIds.some(id => id.toString() === shift.ID)) {
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
        publishEvent(system._id.toString(), { type: 'front:switch', systemId: system._id.toString() });
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
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
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
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
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

        // Verify the shift belongs to an entity in this system
        const entityIds = system[`${parentShift.s_type}s`]?.IDs || [];
        if (!entityIds.some(id => id.toString() === parentShift.ID)) {
            return res.status(404).json({ error: 'Shift not found' });
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

        // Verify the child entity belongs to this system
        const childEntityIds = system[`${entityType}s`]?.IDs || [];
        if (!childEntityIds.some(id => id.toString() === entityId)) {
            return res.status(404).json({ error: `${entityType} not found` });
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
            shiftId: new mongoose.Types.ObjectId(),
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

    const entry = `${entityType}:${entity._id.toString()}`;

    // Remove existing entry for this entity
    system.proxy.recentProxies = system.proxy.recentProxies.filter(
        p => p !== entry
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

async function buildFrontData(system, limited = false, privacyBucket = null) {
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

                    // Check entity-level privacy for child entities
                    if (privacyBucket && !shouldShowEntity(childEntity, privacyBucket, false, false)) continue;

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

// ===========================================
// EDIT HISTORICAL SHIFT
// ===========================================

/**
 * Check if same entity has overlapping shifts
 */
async function checkSameEntityOverlap(entityId, entityType, startTime, endTime, excludeShiftId) {
    const query = {
        s_type: entityType,
        ID: entityId,
        _id: { $ne: excludeShiftId },
        $or: [
            { startTime: { $lt: endTime || new Date() }, endTime: { $gt: startTime } },
            { startTime: { $lt: endTime || new Date() }, endTime: null }
        ]
    };
    return await Shift.find(query);
}

/**
 * PATCH /api/front/shift/:shiftId
 * Retroactively edit a shift's timing and status entries
 * Body: { startTime?, endTime?, statuses?: [{ _id?, status?, battery?, caution?, startTime? }] }
 */
router.patch('/shift/:shiftId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { shiftId } = req.params;
        const { startTime, endTime, statuses, layerId } = req.body;

        const shift = await Shift.findById(shiftId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Verify the shift belongs to an entity in this system
        const entityIds = system[`${shift.s_type}s`]?.IDs || [];
        if (!entityIds.some(id => id.toString() === shift.ID)) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Update timing
        if (startTime !== undefined) shift.startTime = new Date(startTime);
        if (endTime !== undefined) shift.endTime = endTime ? new Date(endTime) : null;

        // Validate timing
        if (shift.endTime && shift.endTime <= shift.startTime) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        // Update statuses
        if (Array.isArray(statuses)) {
            shift.statuses = statuses.map(s => ({
                ...(s._id ? { _id: s._id } : {}),
                status: s.status,
                battery: s.battery,
                caution: s.caution,
                startTime: new Date(s.startTime),
                endTime: s.endTime ? new Date(s.endTime) : null,
                layerID: s.layerID || layerId || shift.statuses?.[0]?.layerID,
                hidden: s.hidden || 'n'
            }));
        }

        // Move to different layer if requested
        if (layerId && layerId !== shift.statuses?.[0]?.layerID?.toString()) {
            // Remove from old layer
            for (const layer of (system.front?.layers || [])) {
                layer.shifts = (layer.shifts || []).filter(s => s.toString() !== shiftId);
            }
            // Add to new layer
            const targetLayer = system.front?.layers?.find(l => l._id.toString() === layerId);
            if (targetLayer) {
                targetLayer.shifts = targetLayer.shifts || [];
                targetLayer.shifts.push(shift._id);
            }
            // Update layerID in all statuses
            for (const status of shift.statuses) {
                status.layerID = new mongoose.Types.ObjectId(layerId);
            }
        }

        await shift.save();
        await system.save();

        // Check for same-entity overlap
        const overlaps = await checkSameEntityOverlap(
            shift.ID, shift.s_type, shift.startTime, shift.endTime, shiftId
        );

        res.json({
            shift,
            overlaps: overlaps.map(o => ({
                _id: o._id,
                startTime: o.startTime,
                endTime: o.endTime,
                type_name: o.type_name
            }))
        });
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
    } catch (err) {
        console.error('[Front] Shift edit error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE HISTORICAL SHIFT
// ===========================================

/**
 * DELETE /api/front/shift/:shiftId
 * Permanently delete a historical shift
 */
router.delete('/shift/:shiftId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { shiftId } = req.params;
        const shift = await Shift.findById(shiftId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Verify the shift belongs to an entity in this system
        const entityIds = system[`${shift.s_type}s`]?.IDs || [];
        if (!entityIds.some(id => id.toString() === shift.ID)) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Remove from parent layer
        for (const layer of (system.front?.layers || [])) {
            layer.shifts = (layer.shifts || []).filter(s => s.toString() !== shiftId);
        }

        await system.save();
        await Shift.findByIdAndDelete(shiftId);

        res.json({ success: true, message: 'Shift deleted' });
        publishEvent(system._id.toString(), { type: 'front:update', systemId: system._id.toString() });
    } catch (err) {
        console.error('[Front] Shift delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// MERGE SHIFTS
// ===========================================

/**
 * POST /api/front/shift/merge
 * Merge two shifts of the same entity into one
 * Body: { shiftIds: [id1, id2] }
 */
router.post('/shift/merge', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);

        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { shiftIds } = req.body;

        if (!Array.isArray(shiftIds) || shiftIds.length !== 2) {
            return res.status(400).json({ error: 'Exactly 2 shift IDs required' });
        }

        const [shiftA, shiftB] = await Promise.all(
            shiftIds.map(id => Shift.findById(id))
        );

        if (!shiftA || !shiftB) {
            return res.status(404).json({ error: 'One or both shifts not found' });
        }

        // Verify both shifts belong to an entity in this system
        const entityIdsA = system[`${shiftA.s_type}s`]?.IDs || [];
        if (!entityIdsA.some(id => id.toString() === shiftA.ID)) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        const entityIdsB = system[`${shiftB.s_type}s`]?.IDs || [];
        if (!entityIdsB.some(id => id.toString() === shiftB.ID)) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Must be same entity
        if (shiftA.s_type !== shiftB.s_type || shiftA.ID !== shiftB.ID) {
            return res.status(400).json({ error: 'Can only merge shifts for the same entity' });
        }

        // Determine earlier and later shift
        const [earlier, later] = shiftA.startTime <= shiftB.startTime ? [shiftA, shiftB] : [shiftB, shiftA];

        // Merge: earliest start, latest end
        earlier.startTime = earlier.startTime;
        earlier.endTime = later.endTime || null;

        // Merge statuses sorted by startTime
        const mergedStatuses = [...(earlier.statuses || []), ...(later.statuses || [])];
        mergedStatuses.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        earlier.statuses = mergedStatuses;

        await earlier.save();

        // Remove the absorbed shift from its layer
        for (const layer of (system.front?.layers || [])) {
            layer.shifts = (layer.shifts || []).filter(s => s.toString() !== later._id.toString());
        }

        await system.save();
        await Shift.findByIdAndDelete(later._id);

        res.json({ success: true, shift: earlier });
    } catch (err) {
        console.error('[Front] Shift merge error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
