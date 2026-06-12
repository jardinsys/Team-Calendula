// User Routes
// Account management: wipe data, delete account

const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Note = require('../../schemas/note');
const Message = require('../../schemas/message');
const { PrivacyBucket } = require('../../schemas/settings');
const { Shift } = require('../../schemas/front');
const { deleteNoteContent } = require('../utils/r2');
const redis = require('../../redis');

// ===========================================
// HELPER: Delete all R2 media from an entity
// ===========================================

// TODO: Add a shared R2 delete utility that handles both app and discord buckets
async function deleteEntityR2Media(entity) {
    const mediaFields = [
        entity.avatar,
        entity.discord?.image?.avatar,
        entity.discord?.image?.banner,
        entity.discord?.image?.proxyAvatar,
        entity.mask?.avatar,
        entity.mask?.discord?.image?.avatar,
        entity.mask?.discord?.image?.banner,
        entity.mask?.discord?.image?.proxyAvatar,
        ...(Array.isArray(entity.discord?.server) ? entity.discord.server.flatMap(s => [s.avatar, s.banner, s.proxyAvatar]) : []),
        ...(Array.isArray(entity.states) ? entity.states.map(s => s.avatar) : [])
    ];

    for (const media of mediaFields) {
        if (media?.r2Key) {
            try {
                const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
                const config = require('../../config.json');
                const bucket = media.bucket || 'app';
                const bucketConfig = bucket === 'discord' ? config.r2?.system?.discord : config.r2?.system?.app;
                if (bucketConfig) {
                    const client = new S3Client({
                        region: 'auto',
                        endpoint: bucketConfig.endpoint,
                        credentials: { accessKeyId: bucketConfig.accessKeyId, secretAccessKey: bucketConfig.secretAccessKey }
                    });
                    await client.send(new DeleteObjectCommand({ Bucket: bucketConfig.bucketName, Key: media.r2Key }));
                }
            } catch (err) {
                console.error(`[User] Failed to delete R2 media ${media.r2Key}:`, err.message);
            }
        }
    }
}

// ===========================================
// HELPER: Clean up user references in other users
// ===========================================

async function cleanUserReferences(userId, discordID, friendID) {
    await User.updateMany(
        { 'friends.discordID': discordID },
        { $pull: { friends: { discordID } } }
    );
    await User.updateMany(
        { 'friendRequests.fromDiscordID': discordID },
        { $pull: { friendRequests: { fromDiscordID: discordID } } }
    );
    await User.updateMany(
        { 'blocked.discordID': discordID },
        { $pull: { blocked: { discordID } } }
    );
    await User.updateMany(
        { 'blocked.friendID': friendID },
        { $pull: { blocked: { friendID } } }
    );
    await Note.updateMany(
        { 'users.rwAccess.userID': userId },
        { $pull: { 'users.rwAccess': { userID: userId } } }
    );
    await Note.updateMany(
        { 'users.rAccess.userID': userId },
        { $pull: { 'users.rAccess': { userID: userId } } }
    );
    await Note.updateMany(
        { 'attribution.userID': userId },
        { $pull: { attribution: { userID: userId } } }
    );
}

// ===========================================
// HELPER: Delete notes + R2 content for a user
// ===========================================

async function deleteUserNotes(userId) {
    const notes = await Note.find({
        $or: [
            { 'author.userID': userId },
            { 'users.owner.userID': userId }
        ]
    });

    for (const note of notes) {
        if (note.content?.r2Key) {
            try { await deleteNoteContent(note.content.r2Key); } catch (e) { /* ignore */ }
        }
        for (const m of (note.media || [])) {
            if (m.media?.r2Key) {
                try { await deleteNoteContent(m.media.r2Key); } catch (e) { /* ignore */ }
            }
        }
    }

    await Note.deleteMany({
        $or: [
            { 'author.userID': userId },
            { 'users.owner.userID': userId }
        ]
    });
}

// ===========================================
// HELPER: Delete messages for a user
// ===========================================

async function deleteUserMessages(discordId) {
    const messages = await Message.find({ discord_user_id: discordId });
    const webhookIds = messages.map(m => m.discord_webhook_message_id).filter(Boolean);

    if (webhookIds.length > 0) {
        try {
            const keys = webhookIds.map(id => `msg:${id}`);
            await redis.del(...keys);
        } catch (e) { /* Redis may be unavailable */ }

        try {
            const userMsgKeys = [];
            const channels = [...new Set(messages.map(m => m.discord_channel_id).filter(Boolean))];
            for (const ch of channels) {
                userMsgKeys.push(`user_msgs:${discordId}:${ch}`);
            }
            if (userMsgKeys.length > 0) await redis.del(...userMsgKeys);
        } catch (e) { /* Redis may be unavailable */ }
    }

    await Message.deleteMany({ discord_user_id: discordId });
}

// ===========================================
// POST /api/user/wipe
// Wipe data: delete notes + messages, keep system
// Body: { confirm: true, keepFriends: boolean }
// ===========================================

// TODO: Require 2FA verification before wipe
router.post('/wipe', authMiddleware, async (req, res) => {
    try {
        if (req.body.confirm !== true) {
            return res.status(400).json({ error: 'Confirmation required', message: 'Set confirm: true in request body' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const keepFriends = req.body.keepFriends === true;

        // Delete notes + R2 content
        await deleteUserNotes(user._id);

        // Delete messages
        await deleteUserMessages(user.discordID);

        // Clear user's note refs
        user.notes = { tags: [], notes: [] };

        // Optionally clear friends
        if (!keepFriends) {
            user.friends = [];
            user.friendRequests = [];
            user.blocked = [];
        }

        await user.save();

        console.log(`[User] Wiped data for user ${user._id} (keepFriends=${keepFriends})`);

        res.json({ success: true, message: 'Data wiped successfully' });
    } catch (err) {
        console.error('[User] Wipe error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===========================================
// DELETE /api/user/account
// Delete account: full cascade or user-only removal
// Body: { confirm: true, systemName: string }
// ===========================================

// TODO: Require 2FA verification before account deletion
router.delete('/account', authMiddleware, async (req, res) => {
    try {
        if (req.body.confirm !== true) {
            return res.status(400).json({ error: 'Confirmation required', message: 'Set confirm: true in request body' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const system = user.systemID ? await System.findById(user.systemID) : null;

        // Verify system name if user has a system
        if (system) {
            const systemName = req.body.systemName;
            if (!systemName) {
                return res.status(400).json({ error: 'Confirmation name required', message: 'Type your system name or username to confirm deletion' });
            }
            const systemDisplayName = system.name?.display?.toLowerCase() || '';
            const systemIndexable = system.name?.indexable?.toLowerCase() || '';
            const inputName = systemName.toLowerCase().trim();
            if (inputName !== systemDisplayName && inputName !== systemIndexable) {
                return res.status(400).json({ error: 'Name does not match', message: 'The name you entered does not match your system name.' });
            }
        }

        // Delete notes + R2 content
        await deleteUserNotes(user._id);

        // Delete messages
        await deleteUserMessages(user.discordID);

        // Clean up references in other users
        await cleanUserReferences(user._id, user.discordID, user.friendID);

        // Clean up guild references
        const Guild = require('../../schemas/guild');
        await Guild.updateMany(
            { userIDs: user.discordID },
            { $pull: { userIDs: user.discordID } }
        );
        await Guild.updateMany(
            { 'admins.memberIDs': user.discordID },
            { $pull: { 'admins.memberIDs': user.discordID } }
        );

        if (system) {
            const otherUsers = system.users.filter(uid => uid.toString() !== user._id.toString());

            if (otherUsers.length === 0) {
                // Single-user system: delete everything
                const alterIds = system.alters?.IDs || [];
                const stateIds = system.states?.IDs || [];
                const groupIds = system.groups?.IDs || [];

                // Delete entities + their R2 media
                const [alters, states, groups] = await Promise.all([
                    Alter.find({ _id: { $in: alterIds } }),
                    State.find({ _id: { $in: stateIds } }),
                    Group.find({ _id: { $in: groupIds } })
                ]);

                for (const entity of [...alters, ...states, ...groups]) {
                    await deleteEntityR2Media(entity);
                }

                await Promise.all([
                    Alter.deleteMany({ _id: { $in: alterIds } }),
                    State.deleteMany({ _id: { $in: stateIds } }),
                    Group.deleteMany({ _id: { $in: groupIds } })
                ]);

                // Delete shifts
                const layerShiftIds = (system.front?.layers || []).flatMap(l => l.shifts || []);
                if (layerShiftIds.length > 0) {
                    await Shift.deleteMany({ _id: { $in: layerShiftIds } });
                }

                // Delete privacy buckets
                const bucketIds = system.privacyBuckets || [];
                if (bucketIds.length > 0) {
                    await PrivacyBucket.deleteMany({ _id: { $in: bucketIds } });
                }

                // Clean up system R2 media
                await deleteEntityR2Media(system);

                // Clean up Redis keys for this system
                try {
                    await redis.del(`system:${system._id}:recentProxies`);
                    await redis.del(`system:${system._id}:break`);
                    await redis.del(`system:${system._id}:lastProxyTime`);
                } catch (e) { /* Redis may be unavailable */ }

                // Delete display cache for all entities
                try {
                    const allEntityIds = [...alterIds, ...stateIds, ...groupIds];
                    for (const eid of allEntityIds) {
                        await redis.del(`display:${eid}:main`);
                    }
                } catch (e) { /* Redis may be unavailable */ }

                // Delete the system
                await System.findByIdAndDelete(system._id);

                console.log(`[User] Deleted system ${system._id} (single-user) and user ${user._id}`);
            } else {
                // Multi-user system: only remove this user
                system.users = otherUsers;
                await system.save();

                // Clear user's system link
                user.systemID = null;

                console.log(`[User] Removed user ${user._id} from multi-user system ${system._id}`);
            }
        }

        // Delete the user document
        await User.findByIdAndDelete(user._id);

        // Invalidate JWT by noting the deletion (JWT is stateless, client must discard)
        console.log(`[User] Deleted account for user ${user._id} (discord: ${user.discordID})`);

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        console.error('[User] Account deletion error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
