// Alters Routes
// Full CRUD operations for alter management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();


const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const Group = require('../../schemas/group');
const { checkProxyExists, createAndLinkEntity } = require('../../discord_commands/functions/bot_utils');
const { uploadMiddleware } = require('../middleware/upload');
const { handleEntityImageUpload, handleEntityImageDelete } = require('./avatar');

function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
            result[key] = deepMerge(result[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// ===========================================
// GET ALL ALTERS
// ===========================================

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const allIds = system.alters?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            const pageIds = allIds.slice(s, s + l);
            const alters = await Alter.find({ _id: { $in: pageIds } })
                .select('_id name avatar color pronouns groupsIDs description proxy metadata states activeStates');
            return res.json({ data: alters, total, hasMore: s + l < total });
        }

        const alters = await Alter.find({ _id: { $in: allIds } })
            .select('_id name avatar color pronouns groupsIDs description proxy metadata states activeStates');
        res.json(alters);
    } catch (err) {
        console.error('[Alters] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/summary', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const allIds = system.alters?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;
        const ids = (skip !== undefined || limit !== undefined)
            ? allIds.slice(parseInt(skip, 10) || 0, (parseInt(skip, 10) || 0) + (parseInt(limit, 10) || 20))
            : allIds;

        const alters = await Alter.find({ _id: { $in: ids } })
            .select('_id name avatar color pronouns');
        
        const mapped = alters.map(a => ({
            _id: a._id,
            name: a.name?.display || a.name?.indexable,
            avatar: a.avatar?.url,
            color: a.color,
            pronouns: a.pronouns
        }));

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            return res.json({ data: mapped, total, hasMore: s + l < total });
        }
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET SINGLE ALTER
// ===========================================

router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        if (!system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found in your system' });
        }
        
        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        // Get groups this alter belongs to
        if (req.query.populate === 'true' && alter.groupsIDs?.length) {
            const groups = await Group.find({ _id: { $in: alter.groupsIDs } })
                .select('_id name avatar color');
            
            return res.json({
                ...alter.toObject(),
                groups: groups.map(g => ({
                    _id: g._id,
                    name: g.name?.display || g.name?.indexable,
                    avatar: g.avatar?.url,
                    color: g.color
                }))
            });
        }
        
        res.json(alter);
    } catch (err) {
        console.error('[Alters] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CREATE ALTER
// ===========================================

router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { name, pronouns, description, color, avatar, birthday, signoff, groupsIDs } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Check for duplicate name
        const existingAlters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
        const idx = name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
        const duplicate = idx ? existingAlters.find(a => a.name?.indexable?.toLowerCase() === idx) : undefined;
        
        if (duplicate) {
            return res.status(400).json({ error: `An alter named "${name}" already exists` });
        }
        
        const alter = new Alter({
            name: {
                display: name,
                ...(idx && { indexable: idx })
            },
            pronouns: pronouns || [],
            description,
            color,
            avatar,
            birthday,
            signoff,
            groupsIDs: groupsIDs || [],
            syncWithApps: { discord: true },
            genesisDate: new Date(),
            metadata: { addedAt: new Date() }
        });

        await createAndLinkEntity(alter, system, 'alter');
        
        // Add to groups if specified
        if (groupsIDs?.length) {
            await Group.updateMany(
                { _id: { $in: groupsIDs } },
                { $addToSet: { alterIDs: alter._id } }
            );
        }
        
        console.log(`[Alters] Created alter ${alter._id} for system ${system._id}`);
        
        res.status(201).json(alter);
    } catch (err) {
        console.error('[Alters] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE ALTER
// ===========================================

router.patch('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system || !system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        const updates = req.body;
        
        // Handle name update
        if (updates.name !== undefined) {
            if (typeof updates.name === 'string') {
                const upIdx = updates.name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                alter.name = {
                    display: updates.name,
                    ...(upIdx && { indexable: upIdx }),
                    closedNameDisplay: alter.name?.closedNameDisplay,
                    aliases: alter.name?.aliases
                };
            } else {
                alter.name = { ...alter.name, ...updates.name };
            }
        }
        
        const allowedFields = [
            'pronouns', 'description', 'color', 'avatar', 'birthday',
            'signoff', 'proxy', 'discord', 'mask', 'caution', 'states',
            'condition'
        ];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (typeof updates[field] === 'object' && updates[field] !== null && !Array.isArray(updates[field]) && alter[field] && typeof alter[field] === 'object') {
                    alter[field] = deepMerge(alter[field], updates[field]);
                } else {
                    alter[field] = updates[field];
                }
            }
        }

        if (updates.name?.aliases !== undefined) {
            alter.name = alter.name || {};
            alter.name.aliases = updates.name.aliases;
        }
        if (updates.name?.closedNameDisplay !== undefined) {
            alter.name = alter.name || {};
            alter.name.closedNameDisplay = updates.name.closedNameDisplay;
        }
        if (updates.setting && typeof updates.setting === 'object') {
            alter.setting = alter.setting || {};
            const allowedSettings = ['default_status', 'default_battery', 'allowPing'];
            for (const key of allowedSettings) {
                if (updates.setting[key] !== undefined) {
                    alter.setting[key] = updates.setting[key];
                }
            }
        }
        
        await alter.save();
        res.json(alter);
    } catch (err) {
        console.error('[Alters] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// ALTER IMAGE UPLOADS
// ===========================================

router.post('/:id/avatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'alter', 'avatar'); } catch (err) { next(err); } });
router.post('/:id/banner', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'alter', 'discord.image.banner'); } catch (err) { next(err); } });
router.post('/:id/proxyAvatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'alter', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });
router.delete('/:id/avatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'alter', 'avatar'); } catch (err) { next(err); } });
router.delete('/:id/banner', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'alter', 'discord.image.banner'); } catch (err) { next(err); } });
router.delete('/:id/proxyAvatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'alter', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });

// ===========================================
// DELETE ALTER
// ===========================================

router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system || !system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        // Remove from groups
        await Group.updateMany(
            { alterIDs: req.params.id },
            { $pull: { alterIDs: req.params.id } }
        );
        
        // Clean up orphaned shifts in front layers
        const { Shift } = require('../../schemas/front');
        for (const layer of system.front?.layers || []) {
            const shiftsToRemove = [];
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && shift.ID === req.params.id && shift.s_type === 'alter') {
                    await Shift.findByIdAndDelete(shiftId);
                    shiftsToRemove.push(shiftId);
                }
            }
            if (shiftsToRemove.length) {
                layer.shifts = layer.shifts.filter(s => !shiftsToRemove.includes(s.toString()));
            }
        }
        
        await Alter.findByIdAndDelete(req.params.id);
        
        system.alters.IDs = system.alters.IDs.filter(id => id !== req.params.id);
        await system.save();
        
        console.log(`[Alters] Deleted alter ${req.params.id}`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Alters] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// PROXY MANAGEMENT
// ===========================================

router.post('/:id/proxy', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        if (!system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }

        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }

        const { proxy } = req.body;
        if (!proxy || !proxy.includes('text')) {
            return res.status(400).json({ error: 'Proxy must contain "text" placeholder' });
        }

        const { exists, entity, type } = await checkProxyExists(proxy, system, alter._id.toString());
        if (exists) {
            return res.status(409).json({ error: `Proxy is already used by ${type} "${entity.name?.display || entity.name?.indexable || 'Unknown'}"` });
        }
        
        alter.proxy = alter.proxy || [];
        if (!alter.proxy.includes(proxy)) {
            alter.proxy.push(proxy);
        }
        
        await alter.save();
        res.json({ success: true, proxies: alter.proxy });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/proxy', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }

        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        const { proxy } = req.body;
        alter.proxy = (alter.proxy || []).filter(p => p !== proxy);
        
        await alter.save();
        res.json({ success: true, proxies: alter.proxy });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GROUP MEMBERSHIP
// ===========================================

router.post('/:id/groups', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }

        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        const { groupIds } = req.body;
        if (!Array.isArray(groupIds)) {
            return res.status(400).json({ error: 'groupIds must be an array' });
        }
        
        alter.groupsIDs = alter.groupsIDs || [];
        for (const groupId of groupIds) {
            if (!alter.groupsIDs.includes(groupId)) {
                alter.groupsIDs.push(groupId);
            }
        }
        
        await alter.save();
        
        // Update groups
        await Group.updateMany(
            { _id: { $in: groupIds } },
            { $addToSet: { alterIDs: alter._id } }
        );
        
        res.json({ success: true, groupsIDs: alter.groupsIDs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/groups/:groupId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system || !system.alters?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Alter not found' });
        }

        const alter = await Alter.findById(req.params.id);
        if (!alter) {
            return res.status(404).json({ error: 'Alter not found' });
        }
        
        alter.groupsIDs = (alter.groupsIDs || []).filter(id => id !== req.params.groupId);
        await alter.save();
        
        // Update group
        await Group.updateOne(
            { _id: req.params.groupId },
            { $pull: { alterIDs: alter._id } }
        );
        
        res.json({ success: true, groupsIDs: alter.groupsIDs });
    } catch (err) {
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

        const validIds = ids.filter(id => system.alters?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid alters found' });

        await Group.updateMany({ alterIDs: { $in: validIds } }, { $pull: { alterIDs: { $in: validIds } } });
        await Alter.deleteMany({ _id: { $in: validIds } });

        system.alters.IDs = system.alters.IDs.filter(id => !validIds.includes(id));
        await system.save();

        res.json({ success: true, deleted: validIds.length });
    } catch (err) {
        console.error('[Alters] Batch delete error:', err);
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

        const validIds = ids.filter(id => system.alters?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid alters found' });

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

        const result = await Alter.updateMany({ _id: { $in: validIds } }, { $set: dbUpdates });
        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        console.error('[Alters] Batch update error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
