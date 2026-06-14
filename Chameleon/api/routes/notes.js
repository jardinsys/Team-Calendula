// Notes Routes
// CRUD operations for note management with sharing, R2 integration, and entity attribution

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { optionalAuthMiddleware } = require('../middleware/auth');
const { broadcastLocal } = require('../../redis');
const Note = require('../../schemas/note');
const User = require('../../schemas/user');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');
const { uploadNoteContent, deleteNoteContent, generatePreview } = require('../utils/r2');

const ATTRIBUTION_CAP = 50;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function getTopLayerEntities(system) {
    const topLayer = system.front?.layers?.[0];
    if (!topLayer) return [];
    const entities = [];
    const stateIds = [];
    for (const shiftId of topLayer.shifts || []) {
        const shift = await Shift.findById(shiftId);
        if (!shift || shift.endTime) continue;
        if (shift.s_type === 'state') {
            stateIds.push(shift.ID);
            continue;
        }
        entities.push({
            entity: { type: shift.s_type, ID: shift.ID },
            entityStates: stateIds.length ? { priorityID: stateIds[0], allIDs: stateIds } : undefined
        });
    }
    return entities;
}

async function getFrontingEntities(system) {
    const entities = [];
    const stateIds = [];
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (!shift || shift.endTime) continue;
            if (shift.s_type === 'state') {
                stateIds.push(shift.ID);
                continue;
            }
            entities.push({
                entity: { type: shift.s_type, ID: shift.ID },
                entityStates: stateIds.length ? { priorityID: stateIds[0], allIDs: stateIds } : undefined
            });
        }
    }
    return entities;
}

async function resolveEntityData(type, id) {
    let entity = null;
    if (type === 'alter') entity = await Alter.findById(id).select('name avatar color');
    else if (type === 'state') entity = await State.findById(id).select('name avatar color');
    else if (type === 'group') entity = await Group.findById(id).select('name avatar color');
    else if (type === 'user') {
        const user = await User.findById(id).select('discordID systemID');
        if (!user) return null;
        const sys = await System.findById(user.systemID).select('name systemSynonym avatar color');
        return {
            type: 'user',
            ID: id,
            name: sys?.systemSynonym || sys?.name || 'User',
            avatar: sys?.avatar?.url,
            color: sys?.color
        };
    }

    if (!entity) return null;
    return {
        type,
        ID: id,
        name: entity.name?.display || entity.name?.indexable || 'Unknown',
        avatar: entity.avatar?.url,
        color: entity.color
    };
}

async function resolveSystemFallback(userId) {
    const user = await User.findById(userId).select('systemID');
    if (!user?.systemID) return null;
    const system = await System.findById(user.systemID).select('name systemSynonym avatar color');
    if (!system) return null;
    return {
        type: 'user',
        name: system.systemSynonym || system.name || 'System',
        avatar: system.avatar?.url,
        color: system.color
    };
}

async function resolveAttributionEntities(entities, userId) {
    if (!entities?.length) {
        const fallback = await resolveSystemFallback(userId);
        return fallback ? [{ entity: fallback }] : [];
    }
    const resolved = [];
    for (const ent of entities) {
        const entityData = ent.entity || ent;
        const data = await resolveEntityData(entityData.type, entityData.ID);
        if (data) {
            const entry = { entity: data };
            if (ent.entityStates?.allIDs?.length) {
                const resolvedStates = [];
                for (const stateId of ent.entityStates.allIDs) {
                    const stateData = await State.findById(stateId).select('name avatar color');
                    if (stateData) {
                        resolvedStates.push({
                            type: 'state',
                            ID: stateId,
                            name: stateData.name?.display || stateData.name?.indexable || 'Unknown',
                            avatar: stateData.avatar?.url,
                            color: stateData.color
                        });
                    }
                }
                if (resolvedStates.length) {
                    const priorityState = resolvedStates.find(s => s.ID === ent.entityStates.priorityID) || resolvedStates[0];
                    entry.entityStates = { priority: priorityState, all: resolvedStates };
                }
            }
            resolved.push(entry);
        }
    }
    if (!resolved.length) {
        const fallback = await resolveSystemFallback(userId);
        if (fallback) resolved.push({ entity: fallback });
    }
    return resolved;
}

function trimAttribution(note) {
    if (note.attribution && note.attribution.length > ATTRIBUTION_CAP) {
        note.attribution = note.attribution.slice(-ATTRIBUTION_CAP);
    }
}

async function buildAttributionResponse(note) {
    const enriched = [];
    for (const entry of (note.attribution || [])) {
        const entities = [];
        for (const ent of (entry.entities || [])) {
            const entityData = ent.entity || ent;
            const data = await resolveEntityData(entityData.type, entityData.ID);
            if (!data) continue;
            const resolved = { entity: data };
            if (ent.entityStates?.allIDs?.length) {
                const resolvedStates = [];
                for (const stateId of ent.entityStates.allIDs) {
                    const stateData = await State.findById(stateId).select('name avatar color');
                    if (stateData) {
                        resolvedStates.push({
                            type: 'state',
                            ID: stateId,
                            name: stateData.name?.display || stateData.name?.indexable || 'Unknown',
                            avatar: stateData.avatar?.url,
                            color: stateData.color
                        });
                    }
                }
                if (resolvedStates.length) {
                    const priorityState = resolvedStates.find(s => s.ID === ent.entityStates.priorityID) || resolvedStates[0];
                    resolved.entityStates = { priority: priorityState, all: resolvedStates };
                }
            }
            entities.push(resolved);
        }
        if (!entities.length && entry.userID) {
            const fallback = await resolveSystemFallback(entry.userID);
            if (fallback) entities.push({ entity: fallback });
        }
        enriched.push({
            entities,
            timestamp: entry.timestamp,
            action: entry.action
        });
    }
    return enriched;
}

// ===========================================
// GET ALL NOTES
// ===========================================

/**
 * GET /api/notes
 * Get all notes for the current user (owned + shared)
 * Query params: ?filter=owned|shared|all&tag=tagname&pinned=true&entityId=&entityType=
 */
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { filter = 'all', tag, pinned, limit = 50, skip = 0, sort = 'pinned', entityId, entityType } = req.query;

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

        if (tag) {
            const tags = tag.split(',').map(t => t.trim());
            query.tags = tags.length === 1 ? tags[0] : { $all: tags };
        }

        if (pinned === 'true') {
            query.pinned = true;
        }

        if (entityId && entityType) {
            query['entityOwner.type'] = entityType;
            query['entityOwner.ID'] = entityId;
        }

        const sortBy = sort === 'recent'
            ? { updatedAt: -1 }
            : { pinned: -1, updatedAt: -1 };

        const notes = await Note.find(query)
            .sort(sortBy)
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .select('id title contentPreview tags pinned color createdAt updatedAt author users media entityOwner attribution');

        const total = await Note.countDocuments(query);

        res.json({
            notes: notes.map(n => ({
                _id: n._id,
                id: n.id,
                title: n.title,
                contentPreview: n.contentPreview,
                tags: n.tags,
                pinned: n.pinned,
                color: n.color,
                media: n.media,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
                entityOwner: n.entityOwner,
                attributionCount: n.attribution?.length || 0,
                isOwner: n.users?.owner?.userID?.toString() === user._id.toString() ||
                         n.author?.userID?.toString() === user._id.toString()
            })),
            total,
            hasMore: parseInt(skip) + notes.length < total
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
router.get('/tags', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user?.notes?.tags || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/notes/tags/:tag
 * Delete a tag from the user's tag collection and all their notes
 */
router.delete('/tags/:tag', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { tag } = req.params;

        if (!user.notes?.tags?.includes(tag)) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        user.notes.tags = user.notes.tags.filter(t => t !== tag);
        await user.save();

        await Note.updateMany(
            { _id: { $in: user.notes?.notes || [] }, tags: tag },
            { $pull: { tags: tag } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[Notes] Delete tag error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET NOTE HISTORY (must be before /:id to avoid shadowing)
// ===========================================

/**
 * GET /api/notes/:id/history
 * Get edit history for a note
 * Query: ?skip=0&limit=20
 */
router.get('/:id/history', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;
        const { skip = 0, limit = 20 } = req.query;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasRead = note.users?.rAccess?.some(a => a.userID?.toString() === userId);
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);

        if (!isOwner && !hasRead && !hasWrite) {
            return res.status(403).json({ error: 'You do not have access to this note' });
        }

        const allEntries = note.attribution || [];
        const sliced = allEntries.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        const enriched = [];
        for (const entry of sliced) {
            const entities = [];
            for (const ent of (entry.entities || [])) {
                const entityData = ent.entity || ent;
                const data = await resolveEntityData(entityData.type, entityData.ID);
                if (!data) continue;
                const resolved = { entity: data };
                if (ent.entityStates?.allIDs?.length) {
                    const resolvedStates = [];
                    for (const stateId of ent.entityStates.allIDs) {
                        const stateData = await State.findById(stateId).select('name avatar color');
                        if (stateData) {
                            resolvedStates.push({
                                type: 'state',
                                ID: stateId,
                                name: stateData.name?.display || stateData.name?.indexable || 'Unknown',
                                avatar: stateData.avatar?.url,
                                color: stateData.color
                            });
                        }
                    }
                    if (resolvedStates.length) {
                        const priorityState = resolvedStates.find(s => s.ID === ent.entityStates.priorityID) || resolvedStates[0];
                        resolved.entityStates = { priority: priorityState, all: resolvedStates };
                    }
                }
                entities.push(resolved);
            }
            if (!entities.length && entry.userID) {
                const fallback = await resolveSystemFallback(entry.userID);
                if (fallback) entities.push({ entity: fallback });
            }
            enriched.push({
                entities,
                timestamp: entry.timestamp,
                action: entry.action
            });
        }

        res.json({
            history: enriched,
            total: allEntries.length,
            hasMore: parseInt(skip) + sliced.length < allEntries.length
        });
    } catch (err) {
        console.error('[Notes] History error:', err);
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
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasRead = note.users?.rAccess?.some(a => a.userID?.toString() === userId);
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
        const inUserNotes = user.notes?.notes?.some(n => n.toString() === note._id.toString());

        if (!isOwner && !hasRead && !hasWrite && !inUserNotes) {
            return res.status(403).json({ error: 'You do not have access to this note' });
        }

        const linkedEntities = { alters: [], states: [], groups: [] };

        if (note.author?.subs?.length) {
            for (const sub of note.author.subs) {
                const data = await resolveEntityData(sub.s_type, sub.ID);
                if (!data) continue;
                if (sub.s_type === 'alter') linkedEntities.alters.push(data);
                else if (sub.s_type === 'state') linkedEntities.states.push(data);
                else if (sub.s_type === 'group') linkedEntities.groups.push(data);
            }
        }

        const entityOwnerData = note.entityOwner
            ? await resolveEntityData(note.entityOwner.type, note.entityOwner.ID)
            : null;

        const enrichedAttribution = await buildAttributionResponse(note);

        res.json({
            ...note.toObject(),
            linkedEntities,
            entityOwner: entityOwnerData,
            attribution: enrichedAttribution,
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
 * Body: { title, content?, tags?, entityOwner?: {type, id}, attribution?: [{type, id}] }
 */
router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { title, content, tags, entityOwner, attribution, pinned, color } = req.body;

        const system = user.systemID ? await System.findById(user.systemID) : null;
        const autoMode = system?.setting?.noteAutoAttribution || 'topLayer';

        let initialAttribution = attribution || [];
        if (!initialAttribution.length && autoMode !== 'off' && system) {
            initialAttribution = autoMode === 'allFronters'
                ? await getFrontingEntities(system)
                : await getTopLayerEntities(system);
        }

        const note = new Note({
            _id: new mongoose.Types.ObjectId(),
            title: title || 'Untitled Note',
            contentPreview: typeof content === 'string' ? generatePreview(content) : undefined,
            tags: tags || [],
            pinned: pinned || false,
            color,
            author: {
                userID: user._id,
                subs: entityOwner ? [{ ID: entityOwner.id, s_type: entityOwner.type }] : []
            },
            users: {
                owner: { userID: user._id }
            },
            entityOwner: entityOwner ? { type: entityOwner.type, ID: entityOwner.id } : undefined,
            attribution: [{
                entities: initialAttribution.map(e => {
                    if (e.entity) return e;
                    return {
                        entity: { type: e.type === 'system' ? 'user' : (e.type || 'user'), ID: e.id || e.ID },
                        entityStates: e.entityStates || undefined
                    };
                }),
                userID: user._id,
                timestamp: new Date(),
                action: 'create'
            }],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await note.save();

        if (typeof content === 'string' && content.length > 0) {
            try {
                const contentMedia = await uploadNoteContent(user._id.toString(), note.id, content);
                note.content = contentMedia;
                await note.save();
            } catch (uploadErr) {
                console.error('[Notes] R2 upload failed:', uploadErr);
            }
        }

        user.notes = user.notes || { tags: [], notes: [] };
        user.notes.notes.push(note._id);

        if (tags?.length) {
            for (const tag of tags) {
                if (!user.notes.tags.includes(tag)) {
                    user.notes.tags.push(tag);
                }
            }
        }

        await user.save();

        res.status(201).json(note);
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'note:created', noteId: note._id.toString() });
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
 * Body: { title?, content?, tags?, pinned?, color?, entityOwner?, attribution?: [{type, id}] }
 */
router.patch('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);

        if (!isOwner && !hasWrite) {
            return res.status(403).json({ error: 'You cannot edit this note' });
        }

        const updates = req.body;

        const allowedFields = ['title', 'tags', 'pinned', 'color'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                note[field] = updates[field];
            }
        }

        if (typeof updates.content === 'string') {
            const oldR2Key = note.content?.r2Key;
            try {
                const contentMedia = await uploadNoteContent(user._id.toString(), note.id, updates.content);
                note.content = contentMedia;
                note.contentPreview = generatePreview(updates.content);
                if (oldR2Key && oldR2Key !== contentMedia.r2Key) {
                    await deleteNoteContent(oldR2Key);
                }
            } catch (uploadErr) {
                console.error('[Notes] R2 upload failed on update:', uploadErr);
                note.contentPreview = generatePreview(updates.content);
            }
        }

        if (updates.entityOwner && isOwner) {
            note.entityOwner = { type: updates.entityOwner.type, ID: updates.entityOwner.id };
        }

        if (updates.tags?.length) {
            for (const tag of updates.tags) {
                if (!user.notes?.tags?.includes(tag)) {
                    user.notes = user.notes || { tags: [], notes: [] };
                    user.notes.tags.push(tag);
                }
            }
            await user.save();
        }

        let attributionEntities = updates.attribution || [];
        if (!attributionEntities.length && isOwner && updates.attribution !== undefined) {
            // Only auto-fill attribution when client explicitly sends an empty attribution array
            const system = user.systemID ? await System.findById(user.systemID) : null;
            const autoMode = system?.setting?.noteAutoAttribution || 'topLayer';
            if (autoMode !== 'off' && system) {
                attributionEntities = autoMode === 'allFronters'
                    ? await getFrontingEntities(system)
                    : await getTopLayerEntities(system);
            }
        }

        if (updates.attribution !== undefined) {
            note.attribution = note.attribution || [];
            note.attribution.push({
                entities: attributionEntities.map(e => {
                    if (e.entity) return e;
                    return {
                        entity: { type: e.type === 'system' ? 'user' : (e.type || 'user'), ID: e.id || e.ID },
                        entityStates: e.entityStates || undefined
                    };
                }),
                userID: user._id,
                timestamp: new Date(),
                action: 'edit'
            });
            trimAttribution(note);
        }

        note.updatedAt = new Date();
        await note.save();

        res.json(note);
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'note:edited', noteId: note._id.toString() });
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
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;

        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can delete this note' });
        }

        if (note.content?.r2Key) {
            try { await deleteNoteContent(note.content.r2Key); } catch (r2Err) { console.error('[Notes] R2 delete failed (proceeding with DB delete):', r2Err); }
        }

        await Note.findByIdAndDelete(note._id);

        user.notes.notes = user.notes.notes.filter(n => n.toString() !== note._id.toString());
        await user.save();

        res.json({ success: true });
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'note:deleted', noteId: note._id.toString() });
    } catch (err) {
        console.error('[Notes] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// APPEND CONTENT
// ===========================================

/**
 * PATCH /api/notes/:id/append
 * Append content to a note with timestamp
 * Body: { content, attribution?: [{type, id}] }
 */
router.patch('/:id/append', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;
        const { content, attribution } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content required' });
        }

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;
        const hasWrite = note.users?.rwAccess?.some(a => a.userID?.toString() === userId);

        if (!isOwner && !hasWrite) {
            return res.status(403).json({ error: 'You cannot edit this note' });
        }

        let existingContent = '';
        if (typeof note.content === 'string') {
            existingContent = note.content;
        } else if (note.content?.url) {
            try {
                const https = require('https');
                const fetchContent = (url) => new Promise((resolve, reject) => {
                    https.get(url, (response) => {
                        let data = '';
                        response.on('data', (chunk) => { data += chunk; });
                        response.on('end', () => resolve(data));
                    }).on('error', reject);
                });
                existingContent = await fetchContent(note.content.url);
            } catch {
                existingContent = note.contentPreview || '';
            }
        }

        const timestamp = `\n\n---\n**${new Date().toLocaleString()}**\n`;
        const newContent = existingContent + timestamp + content;

        try {
            const contentMedia = await uploadNoteContent(user._id.toString(), note.id, newContent);
            const oldR2Key = note.content?.r2Key;
            note.content = contentMedia;
            note.contentPreview = generatePreview(newContent);
            if (oldR2Key && oldR2Key !== contentMedia.r2Key) {
                await deleteNoteContent(oldR2Key);
            }
        } catch (uploadErr) {
            console.error('[Notes] R2 upload failed on append:', uploadErr);
            note.contentPreview = generatePreview(newContent);
        }

        let attributionEntities = attribution || [];
        if (!attributionEntities.length) {
            const system = user.systemID ? await System.findById(user.systemID) : null;
            const autoMode = system?.setting?.noteAutoAttribution || 'topLayer';
            if (autoMode !== 'off' && system) {
                attributionEntities = autoMode === 'allFronters'
                    ? await getFrontingEntities(system)
                    : await getTopLayerEntities(system);
            }
        }

        note.attribution = note.attribution || [];
        note.attribution.push({
            entities: attributionEntities.map(e => {
                if (e.entity) return e;
                return {
                    entity: { type: e.type === 'system' ? 'user' : (e.type || 'user'), ID: e.id || e.ID },
                    entityStates: e.entityStates || undefined
                };
            }),
            userID: user._id,
            timestamp: new Date(),
            action: 'append'
        });
        trimAttribution(note);

        note.updatedAt = new Date();
        await note.save();

        res.json(note);
    } catch (err) {
        console.error('[Notes] Append error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// SHARING
// ===========================================

/**
 * POST /api/notes/:id/share
 * Share a note with another user
 * Body: { discordId?: "123", friendId?: "123", access: "r" | "rw", subs?: [{ID, s_type}] }
 */
router.post('/:id/share', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;
        const { discordId, friendId, access, subs } = req.body;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;

        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can share this note' });
        }

        let targetUser;
        if (discordId) {
            targetUser = await User.findOne({ discordID: discordId });
        } else if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        note.users.rAccess = (note.users.rAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );
        note.users.rwAccess = (note.users.rwAccess || []).filter(
            a => a.userID?.toString() !== targetUser._id.toString()
        );

        if (access === 'rw') {
            const rwEntry = { userID: targetUser._id };
            if (subs?.length) {
                rwEntry.subs = subs.map(s => ({ ID: s.ID || s.id, s_type: s.s_type || s.type }));
            }
            note.users.rwAccess.push(rwEntry);
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
router.delete('/:id/share', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { id } = req.params;
        const { discordId, friendId } = req.body;

        let note = await Note.findOne({ id: id });
        if (!note && mongoose.Types.ObjectId.isValid(id)) {
            note = await Note.findById(id);
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const userId = user._id.toString();
        const isOwner = note.users?.owner?.userID?.toString() === userId ||
                       note.author?.userID?.toString() === userId;

        if (!isOwner) {
            return res.status(403).json({ error: 'Only the owner can modify sharing' });
        }

        let targetUser;
        if (discordId) {
            targetUser = await User.findOne({ discordID: discordId });
        } else if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

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
// LINK/UNLINK ENTITIES (author.subs)
// ===========================================

/**
 * POST /api/notes/:id/link
 * Link an entity to a note's author subs
 * Body: { type: "alter"|"state"|"group", entityId: "123" }
 */
router.post('/:id/link', async (req, res) => {
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

        // Verify ownership
        if (note.users?.owner?.userID?.toString() !== req.user._id?.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        note.author = note.author || {};
        note.author.subs = note.author.subs || [];

        const alreadyLinked = note.author.subs.some(
            s => s.s_type === type && s.ID === entityId
        );

        if (!alreadyLinked) {
            note.author.subs.push({ s_type: type, ID: entityId });
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
 * Unlink an entity from a note's author subs
 * Body: { type: "alter"|"state"|"group", entityId: "123" }
 */
router.delete('/:id/link', async (req, res) => {
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

        // Verify ownership
        if (note.users?.owner?.userID?.toString() !== req.user._id?.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (note.author?.subs?.length) {
            note.author.subs = note.author.subs.filter(
                s => !(s.s_type === type && s.ID === entityId)
            );
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
