// Quick Action Routes
// Chameleon/webapp/api/routes/quick.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const System = require('../../../../schemas/system');
const Alter = require('../../../../schemas/alter');
const State = require('../../../../schemas/state');
const Group = require('../../../../schemas/group');
const Note = require('../../../../schemas/note');
const { Shift } = require('../../../../schemas/front');

// Helper to get display name
function getDisplayName(entity) {
    return entity?.name?.display || entity?.name?.indexable || 'Unknown';
}

// ==========================================
// GET /api/quick/switch
// Get entities for quick switch menu
// ==========================================

router.get('/switch', async (req, res) => {
    try {
        const system = await System.findById(req.user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }
        
        // Get recent proxies first (most used entities)
        const recentProxies = system.proxy?.recentProxies || [];
        const quickEntities = [];
        
        // Add from recent proxies
        for (const proxy of recentProxies.slice(0, 15)) {
            const [type, id] = proxy.split(':');
            let entity = null;
            
            if (type === 'alter') {
                entity = await Alter.findById(id).select('name color avatar');
            } else if (type === 'state') {
                entity = await State.findById(id).select('name color avatar');
            } else if (type === 'group') {
                entity = await Group.findById(id).select('name color avatar type');
                if (entity?.type?.canFront === 'no') continue;
            }
            
            if (entity) {
                quickEntities.push({
                    _id: entity._id,
                    name: getDisplayName(entity),
                    type: type,
                    color: entity.color,
                    avatar: entity.avatar?.url
                });
            }
        }
        
        // If not enough, add remaining alters/states
        if (quickEntities.length < 15) {
            const existingIds = new Set(quickEntities.map(e => e._id.toString()));
            
            const alters = await Alter.find({ 
                _id: { $in: system.alters?.IDs || [] } 
            }).select('name color avatar').limit(20);
            
            for (const alter of alters) {
                if (!existingIds.has(alter._id.toString()) && quickEntities.length < 20) {
                    quickEntities.push({
                        _id: alter._id,
                        name: getDisplayName(alter),
                        type: 'alter',
                        color: alter.color,
                        avatar: alter.avatar?.url
                    });
                    existingIds.add(alter._id.toString());
                }
            }
            
            const states = await State.find({ 
                _id: { $in: system.states?.IDs || [] } 
            }).select('name color avatar').limit(10);
            
            for (const state of states) {
                if (!existingIds.has(state._id.toString()) && quickEntities.length < 25) {
                    quickEntities.push({
                        _id: state._id,
                        name: getDisplayName(state),
                        type: 'state',
                        color: state.color,
                        avatar: state.avatar?.url
                    });
                }
            }
        }
        
        res.json({ quickEntities });
        
    } catch (error) {
        console.error('Quick switch get error:', error);
        res.status(500).json({ error: 'Failed to get quick switch data' });
    }
});

// ==========================================
// POST /api/quick/switch
// Perform a quick switch
// ==========================================

router.post('/switch', async (req, res) => {
    try {
        const { entities, status, battery } = req.body;
        
        const system = await System.findById(req.user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }
        
        const now = new Date();
        
        // Close all active shifts
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    shift.endTime = now;
                    if (shift.statuses?.length > 0) {
                        shift.statuses[shift.statuses.length - 1].endTime = now;
                    }
                    await shift.save();
                }
            }
        }
        
        // Ensure layer exists
        if (!system.front) system.front = {};
        if (!system.front.layers || system.front.layers.length === 0) {
            system.front.layers = [{
                _id: new mongoose.Types.ObjectId(),
                name: 'Main',
                shifts: []
            }];
        }
        
        system.front.layers[0].shifts = [];
        
        // Create new shifts
        const successes = [];
        
        for (const entityInfo of entities || []) {
            const { id, type } = entityInfo;
            
            let entity = null;
            if (type === 'alter') {
                entity = await Alter.findById(id);
            } else if (type === 'state') {
                entity = await State.findById(id);
            } else if (type === 'group') {
                entity = await Group.findById(id);
            }
            
            if (!entity) continue;
            
            const shift = new Shift({
                _id: new mongoose.Types.ObjectId(),
                s_type: type,
                ID: id,
                type_name: getDisplayName(entity),
                startTime: now,
                endTime: null,
                statuses: [{
                    status: null,
                    startTime: now,
                    endTime: null,
                    hidden: 'n'
                }]
            });
            
            await shift.save();
            system.front.layers[0].shifts.push(shift._id);
            
            // Update recent proxies
            const proxyKey = `${type}:${id}`;
            if (!system.proxy) system.proxy = {};
            if (!system.proxy.recentProxies) system.proxy.recentProxies = [];
            system.proxy.recentProxies = system.proxy.recentProxies.filter(p => p !== proxyKey);
            system.proxy.recentProxies.unshift(proxyKey);
            system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
            
            successes.push({
                _id: entity._id,
                name: getDisplayName(entity),
                type,
                color: entity.color
            });
        }
        
        // Update status and battery
        if (status !== undefined) system.front.status = status;
        if (battery !== undefined) system.battery = battery;
        
        await system.save();
        
        res.json({
            success: true,
            fronters: successes,
            status: system.front.status,
            battery: system.battery
        });
        
    } catch (error) {
        console.error('Quick switch error:', error);
        res.status(500).json({ error: 'Failed to switch' });
    }
});

// ==========================================
// POST /api/quick/switch/out
// Switch out (clear front)
// ==========================================

router.post('/switch/out', async (req, res) => {
    try {
        const system = await System.findById(req.user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }
        
        const now = new Date();
        
        // Close all active shifts
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    shift.endTime = now;
                    if (shift.statuses?.length > 0) {
                        shift.statuses[shift.statuses.length - 1].endTime = now;
                    }
                    await shift.save();
                }
            }
            layer.shifts = [];
        }
        
        await system.save();
        
        res.json({ success: true, message: 'Switched out' });
        
    } catch (error) {
        console.error('Switch out error:', error);
        res.status(500).json({ error: 'Failed to switch out' });
    }
});

// ==========================================
// GET /api/quick/notes
// Get recent notes
// ==========================================

router.get('/notes', async (req, res) => {
    try {
        const notes = await Note.find({
            $or: [
                { 'author.userID': req.user._id },
                { 'users.owner.userID': req.user._id }
            ]
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('id title tags pinned updatedAt');
        
        res.json({ notes });
        
    } catch (error) {
        console.error('Quick notes error:', error);
        res.status(500).json({ error: 'Failed to get notes' });
    }
});

// ==========================================
// POST /api/quick/notes
// Create quick note
// ==========================================

router.post('/notes', async (req, res) => {
    try {
        const { title, content, tags } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content required' });
        }
        
        const note = new Note({
            _id: new mongoose.Types.ObjectId(),
            title: title || `Quick Note - ${new Date().toLocaleDateString()}`,
            content,
            tags: tags || [],
            author: { userID: req.user._id },
            users: { owner: { userID: req.user._id } },
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await note.save();
        
        res.status(201).json(note);
        
    } catch (error) {
        console.error('Create quick note error:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

// ==========================================
// PATCH /api/quick/notes/:id/append
// Append to note
// ==========================================

router.patch('/notes/:id/append', async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content required' });
        }
        
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Check access
        const userId = req.user._id.toString();
        const canEdit = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId ||
                       note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
        
        if (!canEdit) {
            return res.status(403).json({ error: 'No permission to edit' });
        }
        
        // Append with timestamp
        const timestamp = `\n\n---\n**${new Date().toLocaleString()}**\n`;
        note.content = (note.content || '') + timestamp + content;
        note.updatedAt = new Date();
        
        await note.save();
        
        res.json(note);
        
    } catch (error) {
        console.error('Append note error:', error);
        res.status(500).json({ error: 'Failed to append to note' });
    }
});

module.exports = router;