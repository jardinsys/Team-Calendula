// Quick Actions Routes
// Handles quickswitch and quicknote for both Discord embeds and webapp

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Note = require('../../schemas/note');
const { Shift } = require('../../schemas/front');

// ===========================================
// QUICK SWITCH
// ===========================================

/**
 * GET /api/quick/switch
 * Get current front and quick-select entities
 */
router.get('/switch', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // Get current fronters
        const currentFront = [];
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    let entity = null;
                    
                    if (shift.s_type === 'alter') {
                        entity = await Alter.findById(shift.ID);
                    } else if (shift.s_type === 'state') {
                        entity = await State.findById(shift.ID);
                    } else if (shift.s_type === 'group') {
                        entity = await Group.findById(shift.ID);
                    }
                    
                    if (entity) {
                        const currentStatus = shift.statuses?.[shift.statuses.length - 1];
                        currentFront.push({
                            _id: entity._id,
                            type: shift.s_type,
                            name: entity.name?.display || entity.name?.indexable,
                            avatar: entity.avatar?.url || entity.discord?.image?.avatar?.url,
                            color: entity.color,
                            layer: layer.name,
                            status: currentStatus?.status,
                            startTime: shift.startTime
                        });
                    }
                }
            }
        }
        
        // Get recent/favorite entities for quick access
        const recentProxies = system.proxy?.recentProxies || [];
        const quickEntities = [];
        
        for (const proxy of recentProxies.slice(0, 12)) {
            const parts = proxy.split(':');
            const type = parts[0];
            const entityId = parts[1];
            
            if (!type || !entityId) continue;
            
            let entity = null;
            if (type === 'alter') {
                entity = await Alter.findById(entityId);
            } else if (type === 'state') {
                entity = await State.findById(entityId);
            } else if (type === 'group') {
                entity = await Group.findById(entityId);
            }
            
            if (entity && !quickEntities.find(e => e._id === entity._id)) {
                quickEntities.push({
                    _id: entity._id,
                    type,
                    name: entity.name?.display || entity.name?.indexable,
                    avatar: entity.avatar?.url || entity.discord?.image?.avatar?.url,
                    color: entity.color,
                    pronouns: entity.pronouns
                });
            }
        }
        
        res.json({
            currentFront,
            quickEntities,
            status: system.front?.status,
            battery: system.battery,
            caution: system.front?.caution
        });
    } catch (err) {
        console.error('[Quick Switch] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quick/switch
 * Execute a quick switch
 * Body: { entities: [{ id, type }], status?, battery? }
 */
router.post('/switch', authMiddleware, async (req, res) => {
    try {
        const { entities, status, battery } = req.body;
        
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // End current shifts
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    shift.endTime = new Date();
                    await shift.save();
                }
            }
        }
        
        // Initialize front structure if needed
        if (!system.front) system.front = {};
        if (!system.front.layers?.length) {
            system.front.layers = [{ 
                _id: new mongoose.Types.ObjectId(), 
                name: 'Main', 
                shifts: [] 
            }];
        }
        
        const mainLayer = system.front.layers[0];
        mainLayer.shifts = [];
        
        // Create new shifts for each entity
        const newFronters = [];
        for (const { id, type } of entities || []) {
            // Validate entity exists
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
                type_name: entity.name?.display || entity.name?.indexable,
                startTime: new Date(),
                statuses: status ? [{ 
                    status, 
                    startTime: new Date(),
                    hidden: 'n'
                }] : []
            });
            
            await shift.save();
            mainLayer.shifts.push(shift._id);
            newFronters.push({
                name: entity.name?.display || entity.name?.indexable,
                type
            });
            
            // Update recent proxies
            const proxyKey = `${type}:${id}`;
            system.proxy = system.proxy || {};
            system.proxy.recentProxies = system.proxy.recentProxies || [];
            system.proxy.recentProxies = system.proxy.recentProxies.filter(p => !p.startsWith(proxyKey));
            system.proxy.recentProxies.unshift(proxyKey);
            system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
        }
        
        // Update status and battery
        if (status !== undefined) system.front.status = status;
        if (battery !== undefined && !isNaN(battery)) {
            system.battery = Math.min(100, Math.max(0, battery));
        }
        
        await system.save();
        
        const message = newFronters.length > 0 
            ? `Switched to: ${newFronters.map(f => f.name).join(', ')}`
            : 'Switched out (no one fronting)';
        
        res.json({ 
            success: true, 
            message,
            fronters: newFronters
        });
    } catch (err) {
        console.error('[Quick Switch] Post error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quick/switch/out
 * Quick switch-out (no one fronting)
 */
router.post('/switch/out', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        // End all current shifts
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    shift.endTime = new Date();
                    await shift.save();
                }
            }
            layer.shifts = [];
        }
        
        await system.save();
        
        res.json({ success: true, message: 'Switched out - no one fronting' });
    } catch (err) {
        console.error('[Quick Switch] Out error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// QUICK NOTE
// ===========================================

/**
 * GET /api/quick/notes
 * Get recent notes for quick access
 */
router.get('/notes', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const noteIds = user?.notes?.notes || [];
        
        const notes = await Note.find({ _id: { $in: noteIds } })
            .sort({ pinned: -1, updatedAt: -1 })
            .limit(15)
            .select('id title tags pinned updatedAt createdAt');
        
        res.json({
            notes: notes.map(n => ({
                _id: n._id,
                id: n.id,
                title: n.title,
                tags: n.tags,
                pinned: n.pinned,
                updatedAt: n.updatedAt
            })),
            tags: user?.notes?.tags || []
        });
    } catch (err) {
        console.error('[Quick Notes] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/quick/notes
 * Create a quick note
 * Body: { title, content, tags?, linkedEntity?: { id, type } }
 */
router.post('/notes', authMiddleware, async (req, res) => {
    try {
        const { title, content, tags, linkedEntity } = req.body;
        
        const user = await User.findById(req.userId);
        
        const note = new Note({
            _id: new mongoose.Types.ObjectId(),
            title: title || `Quick Note - ${new Date().toLocaleDateString()}`,
            content: content || '',
            tags: tags || [],
            pinned: false,
            author: {
                userID: user._id,
                ...(linkedEntity?.type === 'alter' && { alterIDs: [linkedEntity.id] }),
                ...(linkedEntity?.type === 'state' && { stateIDs: [linkedEntity.id] }),
                ...(linkedEntity?.type === 'group' && { groupIDs: [linkedEntity.id] })
            },
            users: {
                owner: { userID: user._id }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await note.save();
        
        // Add note to user's collection
        user.notes = user.notes || { tags: [], notes: [] };
        user.notes.notes.push(note._id);
        
        // Add new tags to user's tag collection
        if (tags?.length) {
            for (const tag of tags) {
                if (!user.notes.tags.includes(tag)) {
                    user.notes.tags.push(tag);
                }
            }
        }
        
        await user.save();
        
        res.status(201).json({
            success: true,
            note: {
                _id: note._id,
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags
            }
        });
    } catch (err) {
        console.error('[Quick Notes] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/quick/notes/:noteId/append
 * Append content to an existing note
 * Body: { content }
 */
router.patch('/notes/:noteId/append', authMiddleware, async (req, res) => {
    try {
        const { noteId } = req.params;
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        // Find note by snowflake ID or MongoDB ID
        let note = await Note.findOne({ id: noteId });
        if (!note && mongoose.Types.ObjectId.isValid(noteId)) {
            note = await Note.findById(noteId);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Verify ownership
        const userId = req.userId.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const canEdit = isOwner || 
                       note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
        
        if (!canEdit) {
            return res.status(403).json({ error: 'You cannot edit this note' });
        }
        
        // Append content with timestamp
        const timestamp = new Date().toLocaleString();
        const separator = note.content ? '\n\n---\n\n' : '';
        note.content = (note.content || '') + separator + `*${timestamp}*\n${content}`;
        note.updatedAt = new Date();
        
        await note.save();
        
        res.json({
            success: true,
            note: {
                _id: note._id,
                id: note.id,
                title: note.title,
                updatedAt: note.updatedAt
            }
        });
    } catch (err) {
        console.error('[Quick Notes] Append error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
