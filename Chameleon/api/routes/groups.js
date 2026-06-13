// Groups Routes
// CRUD operations for group management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();


const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Group = require('../../schemas/group');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const { checkProxyExists, createAndLinkEntity } = require('../../discord_commands/functions/bot_utils');
const { uploadMiddleware } = require('../middleware/upload');
const { handleEntityImageUpload, handleEntityImageDelete } = require('./avatar');

// ===========================================
// GET ALL GROUPS
// ===========================================

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const allIds = system.groups?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            const pageIds = allIds.slice(s, s + l);
            const groups = await Group.find({ _id: { $in: pageIds } })
                .select('_id name avatar color description type alterIDs stateIDs proxy metadata');
            return res.json({ data: groups, total, hasMore: s + l < total });
        }

        const groups = await Group.find({ _id: { $in: allIds } })
            .select('_id name avatar color description type alterIDs stateIDs proxy metadata');
        res.json(groups);
    } catch (err) {
        console.error('[Groups] List error:', err);
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
        
        const allIds = system.groups?.IDs || [];
        const total = allIds.length;
        const { skip, limit } = req.query;
        const ids = (skip !== undefined || limit !== undefined)
            ? allIds.slice(parseInt(skip, 10) || 0, (parseInt(skip, 10) || 0) + (parseInt(limit, 10) || 20))
            : allIds;

        const groups = await Group.find({ _id: { $in: ids } })
            .select('_id name avatar color type');
        
        const mapped = groups.map(g => ({
            _id: g._id,
            name: g.name?.display || g.name?.indexable,
            avatar: g.avatar?.url,
            color: g.color,
            type: g.type?.name,
            canFront: g.type?.canFront
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
// GET SINGLE GROUP
// ===========================================

router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        if (!system.groups?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Group not found in your system' });
        }
        
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Optionally populate members
        if (req.query.populate === 'true') {
            const alters = await Alter.find({ _id: { $in: group.alterIDs || [] } })
                .select('_id name avatar color');
            const states = await State.find({ _id: { $in: group.stateIDs || [] } })
                .select('_id name avatar color');
            
            return res.json({
                ...group.toObject(),
                members: {
                    alters: alters.map(a => ({
                        _id: a._id,
                        name: a.name?.display || a.name?.indexable,
                        avatar: a.avatar?.url,
                        color: a.color
                    })),
                    states: states.map(s => ({
                        _id: s._id,
                        name: s.name?.display || s.name?.indexable,
                        avatar: s.avatar?.url,
                        color: s.color
                    }))
                }
            });
        }
        
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// CREATE GROUP
// ===========================================

router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const { name, description, color, avatar, type, alterIDs, stateIDs, signoff } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const grIdx = name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;

        // Check for duplicate name
        const existingGroups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
        const duplicate = grIdx ? existingGroups.find(g => g.name?.indexable?.toLowerCase() === grIdx) : undefined;
        if (duplicate) {
            return res.status(400).json({ error: `A group named "${name}" already exists` });
        }

        const group = new Group({
            name: {
                display: name,
                ...(grIdx && { indexable: grIdx })
            },
            description,
            color,
            avatar,
            type: type || { name: 'General', canFront: 'yes' },
            alterIDs: alterIDs || [],
            stateIDs: stateIDs || [],
            signoff,
            syncWithApps: { discord: true },
            createdAt: new Date(),
            metadata: { addedAt: new Date() }
        });
        
        await createAndLinkEntity(group, system, 'group');
        
        // Update alters and states to reference this group
        if (alterIDs?.length) {
            await Alter.updateMany(
                { _id: { $in: alterIDs } },
                { $addToSet: { groupsIDs: group._id } }
            );
        }
        if (stateIDs?.length) {
            await State.updateMany(
                { _id: { $in: stateIDs } },
                { $addToSet: { groupIDs: group._id } }
            );
        }
        
        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE GROUP
// ===========================================

router.patch('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system || !system.groups?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const updates = req.body;
        
        if (updates.name !== undefined) {
            if (typeof updates.name === 'string') {
                const grUpIdx = updates.name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                group.name = {
                    display: updates.name,
                    ...(grUpIdx && { indexable: grUpIdx }),
                    closedNameDisplay: group.name?.closedNameDisplay,
                    aliases: group.name?.aliases
                };
            } else {
                group.name = { ...group.name, ...updates.name };
            }
        }
        
        const allowedFields = ['description', 'color', 'avatar', 'signoff', 'type', 'discord', 'mask', 'caution', 'condition', 'alterIDs', 'stateIDs'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                group[field] = updates[field];
            }
        }

        if (updates.name?.aliases !== undefined) {
            group.name = group.name || {};
            group.name.aliases = updates.name.aliases;
        }
        if (updates.name?.closedNameDisplay !== undefined) {
            group.name = group.name || {};
            group.name.closedNameDisplay = updates.name.closedNameDisplay;
        }
        if (updates.setting && typeof updates.setting === 'object') {
            group.setting = group.setting || {};
            const allowedSettings = ['default_status', 'default_battery', 'allowPing'];
            for (const key of allowedSettings) {
                if (updates.setting[key] !== undefined) {
                    group.setting[key] = updates.setting[key];
                }
            }
        }
        
        await group.save();
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// PROXY MANAGEMENT
// ===========================================

router.post('/:id/proxy', async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const { proxy } = req.body;
        if (!proxy || !proxy.includes('text')) {
            return res.status(400).json({ error: 'Proxy must contain "text" placeholder' });
        }

        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }

        const { exists, entity, type } = await checkProxyExists(proxy, system, group._id.toString());
        if (exists) {
            return res.status(409).json({ error: `Proxy is already used by ${type} "${entity.name?.display || entity.name?.indexable || 'Unknown'}"` });
        }
        
        group.proxy = group.proxy || [];
        if (!group.proxy.includes(proxy)) {
            group.proxy.push(proxy);
        }
        
        await group.save();
        res.json({ success: true, proxies: group.proxy });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/proxy', async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const { proxy } = req.body;
        group.proxy = (group.proxy || []).filter(p => p !== proxy);
        
        await group.save();
        res.json({ success: true, proxies: group.proxy });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GROUP IMAGE UPLOADS
// ===========================================

router.post('/:id/avatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'group', 'avatar'); } catch (err) { next(err); } });
router.post('/:id/banner', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'group', 'discord.image.banner'); } catch (err) { next(err); } });
router.post('/:id/proxyAvatar', uploadMiddleware('file'), async (req, res, next) => { try { await handleEntityImageUpload(req, res, 'group', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });
router.delete('/:id/avatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'group', 'avatar'); } catch (err) { next(err); } });
router.delete('/:id/banner', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'group', 'discord.image.banner'); } catch (err) { next(err); } });
router.delete('/:id/proxyAvatar', async (req, res, next) => { try { await handleEntityImageDelete(req, res, 'group', 'discord.image.proxyAvatar'); } catch (err) { next(err); } });

// ===========================================
// DELETE GROUP
// ===========================================

router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        
        if (!system || !system.groups?.IDs?.includes(req.params.id)) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Remove from alters and states
        await Alter.updateMany(
            { groupsIDs: req.params.id },
            { $pull: { groupsIDs: req.params.id } }
        );
        await State.updateMany(
            { groupIDs: req.params.id },
            { $pull: { groupIDs: req.params.id } }
        );
        
        await Group.findByIdAndDelete(req.params.id);
        
        system.groups.IDs = system.groups.IDs.filter(id => id !== req.params.id);
        await system.save();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// MANAGE MEMBERS
// ===========================================

router.post('/:id/members', async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const { alterIDs, stateIDs } = req.body;
        
        if (alterIDs?.length) {
            group.alterIDs = group.alterIDs || [];
            for (const id of alterIDs) {
                if (!group.alterIDs.includes(id)) {
                    group.alterIDs.push(id);
                }
            }
            await Alter.updateMany(
                { _id: { $in: alterIDs } },
                { $addToSet: { groupsIDs: group._id } }
            );
        }
        
        if (stateIDs?.length) {
            group.stateIDs = group.stateIDs || [];
            for (const id of stateIDs) {
                if (!group.stateIDs.includes(id)) {
                    group.stateIDs.push(id);
                }
            }
            await State.updateMany(
                { _id: { $in: stateIDs } },
                { $addToSet: { groupIDs: group._id } }
            );
        }
        
        await group.save();
        res.json({ success: true, alterIDs: group.alterIDs, stateIDs: group.stateIDs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/members', async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const { alterIDs, stateIDs } = req.body;
        
        if (alterIDs?.length) {
            group.alterIDs = (group.alterIDs || []).filter(id => !alterIDs.includes(id));
            await Alter.updateMany(
                { _id: { $in: alterIDs } },
                { $pull: { groupsIDs: group._id } }
            );
        }
        
        if (stateIDs?.length) {
            group.stateIDs = (group.stateIDs || []).filter(id => !stateIDs.includes(id));
            await State.updateMany(
                { _id: { $in: stateIDs } },
                { $pull: { groupIDs: group._id } }
            );
        }
        
        await group.save();
        res.json({ success: true, alterIDs: group.alterIDs, stateIDs: group.stateIDs });
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

        const validIds = ids.filter(id => system.groups?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid groups found' });

        await Alter.updateMany({ groupsIDs: { $in: validIds } }, { $pull: { groupsIDs: { $in: validIds } } });
        await State.updateMany({ groupIDs: { $in: validIds } }, { $pull: { groupIDs: { $in: validIds } } });
        await Group.deleteMany({ _id: { $in: validIds } });

        system.groups.IDs = system.groups.IDs.filter(id => !validIds.includes(id));
        await system.save();

        res.json({ success: true, deleted: validIds.length });
    } catch (err) {
        console.error('[Groups] Batch delete error:', err);
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

        const validIds = ids.filter(id => system.groups?.IDs?.includes(id));
        if (!validIds.length) return res.status(404).json({ error: 'No valid groups found' });

        const allowedFields = ['condition', 'color', 'description', 'proxy', 'type'];
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

        const result = await Group.updateMany({ _id: { $in: validIds } }, { $set: dbUpdates });
        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        console.error('[Groups] Batch update error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
