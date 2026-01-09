// Notes Routes
// CRUD operations for note management with sharing and R2 integration

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const Note = require('../../schemas/note');
const User = require('../../schemas/user');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

// ===========================================
// GET ALL NOTES
// ===========================================

/**
 * GET /api/notes
 * Get all notes for the current user (owned + shared)
 * Query params: ?filter=owned|shared|all&tag=tagname&pinned=true
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { filter = 'all', tag, pinned, limit = 50, skip = 0 } = req.query;
        
        let noteIds = user?.notes?.notes || [];
        let query = {};
        
        if (filter === 'owned') {
            query = {
                $or: [
                    { 'users.owner.userID': user._id },
                    { 'author.userID': user._id }
                ]
            };
        } else if (filter === 'shared') {
            query = {
                $or: [
                    { 'users.rAccess.userID': user._id },
                    { 'users.rwAccess.userID': user._id }
                ]
            };
        } else {
            // All notes user has access to
            query = {
                $or: [
                    { _id: { $in: noteIds } },
                    { 'users.owner.userID': user._id },
                    { 'author.userID': user._id },
                    { 'users.rAccess.userID': user._id },
                    { 'users.rwAccess.userID': user._id }
                ]
            };
        }
        
        // Tag filter
        if (tag) {
            query.tags = tag;
        }
        
        // Pinned filter
        if (pinned === 'true') {
            query.pinned = true;
        }
        
        const notes = await Note.find(query)
            .sort({ pinned: -1, updatedAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .select('id title tags pinned createdAt updatedAt author users');
        
        const total = await Note.countDocuments(query);
        
        res.json({
            notes: notes.map(n => ({
                _id: n._id,
                id: n.id,
                title: n.title,
                tags: n.tags,
                pinned: n.pinned,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
                isOwner: n.users?.owner?.userID?.toString() === user._id.toString() ||
                         n.author?.userID?.toString() === user._id.toString()
            })),
            total,
            hasMore: skip + notes.length < total
        });
    } catch (err) {
        console.error('[Notes] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/notes/tags
 * Get all unique tags used by the user
 */
router.get('/tags', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        res.json(user?.notes?.tags || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET SINGLE NOTE
// ===========================================

/**
 * GET /api/notes/:id
 * Get a single note by ID or snowflake
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { id } = req.params;
        
        // Try by snowflake ID first, then MongoDB ObjectId
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Check access
        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasRead = note.users?.rAccess?.some(a => a.userID?.toString() === userId);
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
        const inUserNotes = user.notes?.notes?.some(n => n.toString() === note._id.toString());
        
        if (!isOwner && !hasRead && !hasWrite && !inUserNotes) {
            return res.status(403).json({ error: 'You do not have access to this note' });
        }
        
        // Get linked entity names
        const linkedEntities = { alters: [], states: [], groups: [] };
        
        if (note.author?.alterIDs?.length) {
            const alters = await Alter.find({ _id: { $in: note.author.alterIDs } })
                .select('_id name avatar color');
            linkedEntities.alters = alters.map(a => ({
                _id: a._id,
                name: a.name?.display || a.name?.indexable,
                avatar: a.avatar?.url,
                color: a.color
            }));
        }
        
        if (note.author?.stateIDs?.length) {
            const states = await State.find({ _id: { $in: note.author.stateIDs } })
                .select('_id name avatar color');
            linkedEntities.states = states.map(s => ({
                _id: s._id,
                name: s.name?.display || s.name?.indexable,
                avatar: s.avatar?.url,
                color: s.color
            }));
        }
        
        if (note.author?.groupIDs?.length) {
            const groups = await Group.find({ _id: { $in: note.author.groupIDs } })
                .select('_id name avatar color');
            linkedEntities.groups = groups.map(g => ({
                _id: g._id,
                name: g.name?.display || g.name?.indexable,
                avatar: g.avatar?.url,
                color: g.color
            }));
        }
        
        res.json({
            ...note.toObject(),
            linkedEntities,
            access: {
                isOwner,
                canEdit: isOwner || hasWrite,
                canRead: true
            }
        });
    } catch (err) {
        console.error('[Notes] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CREATE NOTE
// ===========================================

/**
 * POST /api/notes
 * Create a new note
 * Body: { title, content?, tags?, linkedEntity?: { id, type } }
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { title, content, tags, linkedEntity, pinned, color } = req.body;
        
        const note = new Note({
            _id: new mongoose.Types.ObjectId(),
            title: title || 'Untitled Note',
            content: content || '',
            tags: tags || [],
            pinned: pinned || false,
            color,
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
        
        // Add to user's notes
        user.notes = user.notes || { tags: [], notes: [] };
        user.notes.notes.push(note._id);
        
        // Add new tags
        if (tags?.length) {
            for (const tag of tags) {
                if (!user.notes.tags.includes(tag)) {
                    user.notes.tags.push(tag);
                }
            }
        }
        
        await user.save();
        
        res.status(201).json(note);
    } catch (err) {
        console.error('[Notes] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE NOTE
// ===========================================

/**
 * PATCH /api/notes/:id
 * Update a note
 * Body: { title?, content?, tags?, pinned?, color?, linkedEntity? }
 */
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { id } = req.params;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Check write access
        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
        
        if (!isOwner && !hasWrite) {
            return res.status(403).json({ error: 'You cannot edit this note' });
        }
        
        const updates = req.body;
        
        // Allowed fields
        const allowedFields = ['title', 'content', 'tags', 'pinned', 'color'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                note[field] = updates[field];
            }
        }
        
        // Handle linked entity update
        if (updates.linkedEntity) {
            note.author = note.author || { userID: user._id };
            if (updates.linkedEntity.type === 'alter') {
                note.author.alterIDs = [updates.linkedEntity.id];
            } else if (updates.linkedEntity.type === 'state') {
                note.author.stateIDs = [updates.linkedEntity.id];
            } else if (updates.linkedEntity.type === 'group') {
                note.author.groupIDs = [updates.linkedEntity.id];
            }
        }
        
        // Add new tags to user's collection
        if (updates.tags?.length) {
            for (const tag of updates.tags) {
                if (!user.notes?.tags?.includes(tag)) {
                    user.notes = user.notes || { tags: [], notes: [] };
                    user.notes.tags.push(tag);
                }
            }
            await user.save();
        }
        
        note.updatedAt = new Date();
        await note.save();
        
        res.json(note);
    } catch (err) {
        console.error('[Notes] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE NOTE
// ===========================================

/**
 * DELETE /api/notes/:id
 * Delete a note (owner only)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { id } = req.params;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Only owner can delete
        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can delete this note' });
        }
        
        await Note.findByIdAndDelete(note._id);
        
        // Remove from user's notes
        user.notes.notes = user.notes.notes.filter(n => n.toString() !== note._id.toString());
        await user.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Notes] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// SHARING
// ===========================================

/**
 * POST /api/notes/:id/share
 * Share a note with another user
 * Body: { discordId: "123", access: "r" | "rw" }
 */
router.post('/:id/share', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { id } = req.params;
        const { discordId, friendId, access } = req.body;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Only owner can share
        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can share this note' });
        }
        
        // Find target user
        let targetUser;
        if (discordId) {
            targetUser = await User.findOne({ discordID: discordId });
        } else if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        }
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove from other access list first
        note.users.rAccess = (note.users.rAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );
        note.users.rwAccess = (note.users.rwAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );
        
        // Add to appropriate access list
        if (access === 'rw') {
            note.users.rwAccess.push({ userID: targetUser._id });
        } else {
            note.users.rAccess = note.users.rAccess || [];
            note.users.rAccess.push({ userID: targetUser._id });
        }
        
        await note.save();
        
        res.json({ success: true, message: `Note shared with ${access} access` });
    } catch (err) {
        console.error('[Notes] Share error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/notes/:id/share
 * Remove someone's access to a note
 * Body: { discordId: "123" } or { friendId: "123" }
 */
router.delete('/:id/share', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const { id } = req.params;
        const { discordId, friendId } = req.body;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        // Only owner can unshare
        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        
        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can modify sharing' });
        }
        
        // Find target user
        let targetUser;
        if (discordId) {
            targetUser = await User.findOne({ discordID: discordId });
        } else if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        }
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove from both access lists
        note.users.rAccess = (note.users.rAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );
        note.users.rwAccess = (note.users.rwAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );
        
        await note.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Notes] Unshare error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// LINK/UNLINK ENTITIES
// ===========================================

/**
 * POST /api/notes/:id/link
 * Link an entity to a note
 * Body: { type: "alter"|"state"|"group", entityId: "123" }
 */
router.post('/:id/link', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, entityId } = req.body;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        note.author = note.author || {};
        
        if (type === 'alter') {
            note.author.alterIDs = note.author.alterIDs || [];
            if (!note.author.alterIDs.includes(entityId)) {
                note.author.alterIDs.push(entityId);
            }
        } else if (type === 'state') {
            note.author.stateIDs = note.author.stateIDs || [];
            if (!note.author.stateIDs.includes(entityId)) {
                note.author.stateIDs.push(entityId);
            }
        } else if (type === 'group') {
            note.author.groupIDs = note.author.groupIDs || [];
            if (!note.author.groupIDs.includes(entityId)) {
                note.author.groupIDs.push(entityId);
            }
        }
        
        note.updatedAt = new Date();
        await note.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Notes] Link error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/notes/:id/link
 * Unlink an entity from a note
 * Body: { type: "alter"|"state"|"group", entityId: "123" }
 */
router.delete('/:id/link', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, entityId } = req.body;
        
        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }
        
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        
        if (type === 'alter' && note.author?.alterIDs) {
            note.author.alterIDs = note.author.alterIDs.filter(id => id !== entityId);
        } else if (type === 'state' && note.author?.stateIDs) {
            note.author.stateIDs = note.author.stateIDs.filter(id => id !== entityId);
        } else if (type === 'group' && note.author?.groupIDs) {
            note.author.groupIDs = note.author.groupIDs.filter(id => id !== entityId);
        }
        
        note.updatedAt = new Date();
        await note.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Notes] Unlink error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
