// Public Routes
// Privacy-gated entity view for the embedded app

const express = require('express');
const router = express.Router();

const { optionalAuthMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

const VALID_TYPES = ['alter', 'state', 'group'];

function getPrivacyBucket(system, viewerDiscordId, viewerFriendId) {
    if (!system?.privacyBuckets) return null;
    for (const bucket of system.privacyBuckets) {
        const inBucket = bucket.friends?.some(f =>
            f.discordUserID === viewerDiscordId || f.friendID === viewerFriendId
        );
        if (inBucket) return bucket;
    }
    return null;
}

function filterEntityFields(entity, bucketName) {
    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === bucketName);
    const canShow = (field) => !entityPrivacy || entityPrivacy.settings?.[field] !== false;

    const obj = entity.toObject();

    const filtered = {
        _id: obj._id,
        name: obj.name,
        color: obj.color,
        avatar: canShow('avatar') ? obj.avatar : undefined,
    };

    if (canShow('description')) filtered.description = obj.description;
    if (canShow('pronouns')) filtered.pronouns = obj.pronouns;
    if (canShow('birthday')) filtered.birthday = obj.birthday;
    if (canShow('caution')) filtered.caution = obj.caution;
    if (canShow('proxies')) filtered.proxy = obj.proxy;

    return filtered;
}

router.get('/entity/:type/:id', optionalAuthMiddleware, async (req, res) => {
    try {
        const { type, id } = req.params;

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Invalid entity type' });
        }

        let entity;
        if (type === 'alter') entity = await Alter.findById(id);
        else if (type === 'state') entity = await State.findById(id);
        else entity = await Group.findById(id);

        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        const isOwner = req.user?.systemID?.toString() === entity.systemID?.toString();

        if (isOwner) {
            const result = entity.toObject();

            if (type === 'alter' && entity.groupsIDs?.length) {
                const groups = await Group.find({ _id: { $in: entity.groupsIDs } })
                    .select('_id name avatar color');
                result.groups = groups.map(g => ({
                    _id: g._id,
                    name: g.name?.display || g.name?.indexable,
                    avatar: g.avatar?.url,
                    color: g.color
                }));
            }

            if (type === 'group' && (entity.alterIDs?.length || entity.stateIDs?.length)) {
                const [alters, states] = await Promise.all([
                    entity.alterIDs?.length
                        ? Alter.find({ _id: { $in: entity.alterIDs } }).select('_id name avatar color')
                        : Promise.resolve([]),
                    entity.stateIDs?.length
                        ? State.find({ _id: { $in: entity.stateIDs } }).select('_id name avatar color')
                        : Promise.resolve([])
                ]);
                result.members = {
                    alters: alters.map(a => ({ _id: a._id, name: a.name?.display || a.name?.indexable, avatar: a.avatar?.url, color: a.color })),
                    states: states.map(s => ({ _id: s._id, name: s.name?.display || s.name?.indexable, avatar: s.avatar?.url, color: s.color }))
                };
            }

            return res.json({ entity: result, isOwner: true, type });
        }

        const system = await System.findById(entity.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found' });
        }

        const viewerDiscordId = req.user?.discordID;
        const bucket = getPrivacyBucket(system, viewerDiscordId, null);

        if (!bucket) {
            return res.json({
                entity: {
                    _id: entity._id,
                    name: entity.name,
                    color: entity.color,
                    avatar: entity.avatar?.url ? { url: entity.avatar.url } : undefined,
                },
                isOwner: false,
                type
            });
        }

        const filtered = filterEntityFields(entity, bucket.name);
        return res.json({ entity: filtered, isOwner: false, type });
    } catch (err) {
        console.error('[Public] Entity view error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
