// Friends Routes
// Friend management and viewing friends' fronts

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { broadcastLocal } = require('../../redis');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');

// ===========================================
// GET FRIENDS LIST
// ===========================================

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const friends = user?.friends || [];
        
        const { skip, limit } = req.query;
        const total = friends.length;
        const page = (skip !== undefined || limit !== undefined)
            ? friends.slice(parseInt(skip, 10) || 0, (parseInt(skip, 10) || 0) + (parseInt(limit, 10) || 20))
            : friends;

        // Batch lookup: collect all discordIDs and friendIDs
        const discordIds = page.map(f => f.discordID).filter(Boolean);
        const friendIds = page.map(f => f.friendID).filter(Boolean);

        const friendUsers = await User.find({
            $or: [
                { discordID: { $in: discordIds } },
                { friendID: { $in: friendIds } }
            ]
        }).select('_id friendID discordID systemID');

        // Map for O(1) lookup
        const userMap = new Map();
        for (const fu of friendUsers) {
            if (fu.discordID) userMap.set(`d:${fu.discordID}`, fu);
            if (fu.friendID) userMap.set(`f:${fu.friendID}`, fu);
        }

        // Batch lookup systems
        const systemIds = [...new Set(friendUsers.map(fu => fu.systemID).filter(Boolean))];
        const systems = await System.find({ _id: { $in: systemIds } })
            .select('name avatar front battery');
        const systemMap = new Map(systems.map(s => [s._id.toString(), s]));

        // Batch lookup all active shifts across all friend systems
        const allShiftIds = [];
        for (const sys of systems) {
            for (const layer of sys.front?.layers || []) {
                for (const shiftId of layer.shifts || []) {
                    allShiftIds.push(shiftId);
                }
            }
        }
        const activeShifts = allShiftIds.length > 0
            ? await Shift.find({ _id: { $in: allShiftIds }, endTime: { $exists: false } })
            : [];
        const shiftMap = new Map(activeShifts.map(s => [s._id.toString(), s]));

        // Batch lookup entities from active shifts
        const entityLookups = new Map();
        for (const shift of activeShifts) {
            const key = `${shift.s_type}:${shift.ID}`;
            if (!entityLookups.has(key)) {
                entityLookups.set(key, { type: shift.s_type, id: shift.ID });
            }
        }
        const entityMap = new Map();
        for (const [key, { type, id }] of entityLookups) {
            let entity;
            if (type === 'alter') entity = await Alter.findById(id).select('name avatar color');
            else if (type === 'state') entity = await State.findById(id).select('name avatar color');
            else if (type === 'group') entity = await Group.findById(id).select('name avatar color');
            if (entity) entityMap.set(key, entity);
        }

        // Build enriched friends
        const enrichedFriends = [];
        for (const friend of page) {
            const friendUser = friend.discordID
                ? userMap.get(`d:${friend.discordID}`)
                : userMap.get(`f:${friend.friendID}`);

            if (!friendUser) continue;

            const system = friendUser.systemID
                ? systemMap.get(friendUser.systemID.toString())
                : null;

            const currentFront = [];
            if (system?.front?.layers) {
                for (const layer of system.front.layers) {
                    for (const shiftId of layer.shifts || []) {
                        const shift = shiftMap.get(shiftId.toString());
                        if (!shift) continue;
                        const entity = entityMap.get(`${shift.s_type}:${shift.ID}`);
                        if (entity) {
                            currentFront.push({
                                name: entity.name?.closedNameDisplay || entity.name?.display || entity.name?.indexable,
                                avatar: entity.avatar?.url,
                                color: entity.color,
                                type: shift.s_type
                            });
                        }
                    }
                }
            }

            enrichedFriends.push({
                _id: friendUser._id,
                friendID: friendUser.friendID,
                discordID: friendUser.discordID,
                customName: friend.customName?.display,
                addedAt: friend.addedAt,
                system: system ? {
                    _id: system._id,
                    name: system.name?.display || system.name?.indexable,
                    avatar: system.avatar?.url,
                    status: system.front?.status,
                    battery: system.battery
                } : null,
                currentFront,
                hasSystem: !!system
            });
        }

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            return res.json({ data: enrichedFriends, total, hasMore: s + l < total });
        }
        res.json(enrichedFriends);
    } catch (err) {
        console.error('[Friends] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// ADD FRIEND
// ===========================================

router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = user.systemID ? await System.findById(user.systemID) : null;
        const { friendId, discordId } = req.body;
        
        if (!friendId && !discordId) {
            return res.status(400).json({ error: 'friendId or discordId is required' });
        }
        
        let targetUser;
        if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        } else {
            targetUser = await User.findOne({ discordID: discordId });
        }
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (targetUser._id.toString() === user._id.toString()) {
            return res.status(400).json({ error: 'Cannot add yourself' });
        }
        
        const alreadyFriend = user.friends?.some(
            f => f.friendID === targetUser.friendID || f.discordID === targetUser.discordID
        );
        if (alreadyFriend) {
            return res.status(400).json({ error: 'Already friends' });
        }
        
        const alreadyRequested = targetUser.friendRequests?.some(
            r => r.fromDiscordID === user.discordID
        );
        if (alreadyRequested) {
            return res.status(400).json({ error: 'Friend request already sent' });
        }
        
        const alreadyBlocked = targetUser.blocked?.some(
            b => b.discordID === user.discordID || b.friendID === user.friendID
        );
        if (alreadyBlocked) {
            return res.status(403).json({ error: 'Cannot send friend request' });
        }
        
        targetUser.friendRequests = targetUser.friendRequests || [];
        targetUser.friendRequests.push({
            fromDiscordID: user.discordID,
            fromFriendID: user.friendID,
            fromName: user.discord?.name?.display || user.username,
            fromSystemName: system?.name?.display,
            sentAt: new Date()
        });
        
        await targetUser.save();
        
        res.status(201).json({ success: true, message: 'Friend request sent' });
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'friend:request', toUserId: targetUser._id.toString() });
    } catch (err) {
        console.error('[Friends] Add error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/requests', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const all = user?.friendRequests || [];
        const { skip, limit } = req.query;

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            return res.json({ data: all.slice(s, s + l), total: all.length, hasMore: s + l < all.length });
        }
        res.json(all);
    } catch (err) {
        console.error('[Friends] Get requests error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/requests/:index/accept', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const idx = parseInt(req.params.index, 10);
        
        if (isNaN(idx) || idx < 0 || idx >= (user.friendRequests?.length || 0)) {
            return res.status(400).json({ error: 'Invalid request index' });
        }
        
        const request = user.friendRequests[idx];
        const requesterUser = await User.findOne({ discordID: request.fromDiscordID });
        
        if (!requesterUser) {
            user.friendRequests.splice(idx, 1);
            await user.save();
            return res.status(404).json({ error: 'Requester not found' });
        }
        
        const requesterSystem = requesterUser.systemID ? await System.findById(requesterUser.systemID) : null;
        const accepterSystem = user.systemID ? await System.findById(user.systemID) : null;
        
        user.friends = user.friends || [];
        if (!user.friends.some(f => f.friendID === requesterUser.friendID)) {
            user.friends.push({
                friendID: requesterUser.friendID,
                discordID: requesterUser.discordID,
                privacyBucket: requesterSystem?.setting?.friendAutoBucket || undefined,
                addedAt: new Date(),
                notifyOnSwitch: false
            });
        }
        
        requesterUser.friends = requesterUser.friends || [];
        if (!requesterUser.friends.some(f => f.friendID === user.friendID)) {
            requesterUser.friends.push({
                friendID: user.friendID,
                discordID: user.discordID,
                privacyBucket: accepterSystem?.setting?.friendAutoBucket || undefined,
                addedAt: new Date(),
                notifyOnSwitch: false
            });
        }
        
        user.friendRequests.splice(idx, 1);
        
        await Promise.all([user.save(), requesterUser.save()]);
        
        res.json({ success: true });
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'friend:accepted', fromUserId: requesterUser._id.toString() });
    } catch (err) {
        console.error('[Friends] Accept request error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/requests/:index/decline', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const idx = parseInt(req.params.index, 10);
        
        if (isNaN(idx) || idx < 0 || idx >= (user.friendRequests?.length || 0)) {
            return res.status(400).json({ error: 'Invalid request index' });
        }
        
        user.friendRequests.splice(idx, 1);
        await user.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Friends] Decline request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// REMOVE FRIEND
// ===========================================

router.delete('/:friendId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { friendId } = req.params;
        
        user.friends = (user.friends || []).filter(
            f => f.friendID !== friendId && f.discordID !== friendId
        );
        
        await user.save();
        res.json({ success: true });
        if (user.systemID) broadcastLocal(user.systemID.toString(), { type: 'friend:removed', friendId });
    } catch (err) {
        console.error('[Friends] Remove error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// UPDATE FRIEND
// ===========================================

router.patch('/:friendId', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { friendId } = req.params;
        const { customName, privacyBucket, notifyOnSwitch } = req.body;
        
        const friend = user.friends?.find(
            f => f.friendID === friendId || f.discordID === friendId
        );
        
        if (!friend) {
            return res.status(404).json({ error: 'Friend not found' });
        }
        
        if (customName !== undefined) {
            friend.customName = customName ? (() => {
                const frUpIdx = customName.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
                return { display: customName, ...(frUpIdx && { indexable: frUpIdx }) };
            })() : undefined;
        }
        
        if (privacyBucket !== undefined) {
            friend.privacyBucket = privacyBucket;
        }
        
        if (notifyOnSwitch !== undefined) {
            friend.notifyOnSwitch = Boolean(notifyOnSwitch);
        }
        
        await user.save();
        res.json({ success: true });
    } catch (err) {
        console.error('[Friends] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// BLOCK/UNBLOCK
// ===========================================

router.post('/block', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { friendId, discordId } = req.body;
        
        let targetUser;
        if (friendId) {
            targetUser = await User.findOne({ friendID: friendId });
        } else if (discordId) {
            targetUser = await User.findOne({ discordID: discordId });
        }
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove from friends
        user.friends = (user.friends || []).filter(
            f => f.friendID !== targetUser.friendID && f.discordID !== targetUser.discordID
        );
        
        // Add to blocked
        const alreadyBlocked = user.blocked?.some(
            b => b.friendID === targetUser.friendID
        );
        
        if (!alreadyBlocked) {
            user.blocked = user.blocked || [];
            user.blocked.push({
                friendID: targetUser.friendID,
                discordID: targetUser.discordID,
                addedAt: new Date()
            });
        }
        
        await user.save();
        res.json({ success: true });
    } catch (err) {
        console.error('[Friends] Block error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/block/:id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.blocked = (user.blocked || []).filter(
            b => b.friendID !== req.params.id && b.discordID !== req.params.id
        );
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/blocked', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const all = user?.blocked || [];
        const { skip, limit } = req.query;

        if (skip !== undefined || limit !== undefined) {
            const s = parseInt(skip, 10) || 0;
            const l = parseInt(limit, 10) || 20;
            return res.json({ data: all.slice(s, s + l), total: all.length, hasMore: s + l < all.length });
        }
        res.json(all);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET MY FRIEND ID
// ===========================================

router.get('/my-id', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ 
            friendID: user.friendID,
            discordID: user.discordID
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// GET FRIEND'S FRONT
// ===========================================

router.get('/:friendId/front', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { friendId } = req.params;
        
        const isFriend = user.friends?.some(
            f => f.friendID === friendId || f.discordID === friendId
        );
        
        if (!isFriend) {
            return res.status(403).json({ error: 'Not friends' });
        }
        
        let friendUser = await User.findOne({ friendID: friendId });
        if (!friendUser) {
            friendUser = await User.findOne({ discordID: friendId });
        }
        
        if (!friendUser || !friendUser.systemID) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const system = await System.findById(friendUser.systemID);
        if (!system) {
            return res.status(404).json({ error: 'Not registered' });
        }
        
        const frontData = {
            systemName: system.name?.closedNameDisplay || system.name?.display || system.name?.indexable,
            avatar: system.avatar?.url,
            status: system.front?.status,
            battery: system.battery,
            caution: system.front?.caution,
            layers: []
        };
        
        for (const layer of system.front?.layers || []) {
            const layerData = { name: layer.name, fronters: [] };
            
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
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
                    name: entity.name?.closedNameDisplay || entity.name?.display || entity.name?.indexable,
                    avatar: entity.avatar?.url,
                    color: entity.color,
                    status: currentStatus?.status,
                    startTime: shift.startTime
                });
            }
            
            if (layerData.fronters.length > 0) {
                frontData.layers.push(layerData);
            }
        }
        
        res.json(frontData);
    } catch (err) {
        console.error('[Friends] Get front error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
