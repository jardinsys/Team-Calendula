// Front Routes
// View and manage front/switch status

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');

// ===========================================
// GET CURRENT FRONT
// ===========================================

/**
 * GET /api/front
 * Get current front status for the authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const frontData = await buildFrontData(system);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Get error:', err);
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
        const isOwner = req.userId && system.users?.some(u => u.toString() === req.userId);
        
        // TODO: Add privacy bucket checking here
        // For now, return basic front info
        
        const frontData = await buildFrontData(system, !isOwner);
        res.json(frontData);
    } catch (err) {
        console.error('[Front] Get by ID error:', err);
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
router.patch('/status', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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

// ===========================================
// SWITCH HISTORY
// ===========================================

/**
 * GET /api/front/history
 * Get switch history
 * Query: ?limit=10&before=timestamp
 */
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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
router.get('/layers', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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

/**
 * POST /api/front/layers
 * Create a new front layer
 * Body: { name, color? }
 */
router.post('/layers', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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
router.delete('/layers/:layerId', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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
 * Update the status of an active shift
 * Body: { status }
 */
router.patch('/shift/:shiftId/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        
        const shift = await Shift.findById(req.params.shiftId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        
        if (shift.endTime) {
            return res.status(400).json({ error: 'Cannot update ended shift' });
        }
        
        // End previous status
        if (shift.statuses?.length > 0) {
            const lastStatus = shift.statuses[shift.statuses.length - 1];
            if (!lastStatus.endTime) {
                lastStatus.endTime = new Date();
            }
        }
        
        // Add new status
        shift.statuses = shift.statuses || [];
        shift.statuses.push({
            status,
            startTime: new Date(),
            hidden: 'n'
        });
        
        await shift.save();
        
        res.json({ success: true, status });
    } catch (err) {
        console.error('[Front] Update shift status error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

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
            
            // Only show active shifts
            if (!shift || shift.endTime) continue;
            
            let entity = null;
            if (shift.s_type === 'alter') {
                entity = await Alter.findById(shift.ID);
            } else if (shift.s_type === 'state') {
                entity = await State.findById(shift.ID);
            } else if (shift.s_type === 'group') {
                entity = await Group.findById(shift.ID);
            }
            
            if (!entity) continue;
            
            const currentStatus = shift.statuses?.[shift.statuses.length - 1];
            
            layerData.fronters.push({
                _id: entity._id,
                type: shift.s_type,
                name: limited 
                    ? (entity.name?.closedNameDisplay || entity.name?.display || entity.name?.indexable)
                    : (entity.name?.display || entity.name?.indexable),
                avatar: entity.avatar?.url || entity.discord?.image?.avatar?.url,
                color: entity.color,
                pronouns: limited ? undefined : entity.pronouns,
                status: currentStatus?.status,
                startTime: shift.startTime,
                duration: Date.now() - new Date(shift.startTime).getTime()
            });
        }
        
        if (layerData.fronters.length > 0 || !limited) {
            frontData.layers.push(layerData);
        }
    }
    
    return frontData;
}

module.exports = router;
