// Groups Routes
// CRUD operations for group management

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Group = require('../../schemas/group');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');

// ===========================================
// GET ALL GROUPS
// ===========================================

router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } })
            .select('_id name avatar color description type alterIDs stateIDs proxy metadata');
        
        res.json(groups);
    } catch (err) {
        console.error('[Groups] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } })
            .select('_id name avatar color type');
        
        res.json(groups.map(g => ({
            _id: g._id,
            name: g.name?.display || g.name?.indexable,
            avatar: g.avatar?.url,
            color: g.color,
            type: g.type?.name,
            canFront: g.type?.canFront
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET SINGLE GROUP
// ===========================================

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
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

router.post('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const system = await System.findById(user?.systemID);
        
        if (!system) {
            return res.status(404).json({ error: 'No system found' });
        }
        
        const { name, description, color, avatar, type, alterIDs, stateIDs, signoff } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const group = new Group({
            systemID: system._id,
            name: {
                display: name,
                indexable: name.toLowerCase().replace(/[^a-z0-9]/g, '')
            },
            description,
            color,
            avatar,
            type: type || { name: 'General', canFront: 'yes' },
            alterIDs: alterIDs || [],
            stateIDs: stateIDs || [],
            signoff,
            createdAt: new Date()
        });
        
        await group.save();
        
        system.groups = system.groups || { IDs: [] };
        system.groups.IDs.push(group._id);
        await system.save();
        
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

router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
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
                group.name = {
                    display: updates.name,
                    indexable: updates.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    closedNameDisplay: group.name?.closedNameDisplay,
                    aliases: group.name?.aliases
                };
            } else {
                group.name = { ...group.name, ...updates.name };
            }
        }
        
        const allowedFields = ['description', 'color', 'avatar', 'signoff', 'type', 'proxy', 'discord', 'mask', 'caution'];
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                group[field] = updates[field];
            }
        }
        
        await group.save();
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE GROUP
// ===========================================

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
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

router.post('/:id/members', authMiddleware, async (req, res) => {
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

router.delete('/:id/members', authMiddleware, async (req, res) => {
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

module.exports = router;
