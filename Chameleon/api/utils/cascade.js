// Cascade deletion utilities
// Shared between DELETE /api/system and DELETE /api/user/account

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../../config.json');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Note = require('../../schemas/note');
const Message = require('../../schemas/message');
const { PrivacyBucket } = require('../../schemas/settings');
const { Shift } = require('../../schemas/front');
const { deleteNoteContent } = require('./r2');
const redis = require('../../redis');

// ===========================================
// Delete all R2 media from an entity or system
// Handles both 'app' and 'discord' buckets
// ===========================================

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
        entity.theme?.background?.media,
        entity.mask?.theme?.background?.media,
        ...(Array.isArray(entity.discord?.server) ? entity.discord.server.flatMap(s => [s.avatar, s.banner, s.proxyAvatar]) : []),
        ...(Array.isArray(entity.states) ? entity.states.map(s => s.avatar) : [])
    ];

    for (const media of mediaFields) {
        if (media?.r2Key) {
            try {
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
                console.error(`[Cascade] Failed to delete R2 media ${media.r2Key}:`, err.message);
            }
        }
    }
}

// ===========================================
// Clean up user references in other users
// Removes friends, friend requests, blocked, note access
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
// Delete notes + R2 content for a user
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
// Delete messages + Redis cache for a user
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
// Delete system data: entities, shifts, buckets,
// R2 media, Redis keys, display cache
// Does NOT delete the System doc itself
// ===========================================

async function deleteSystemData(system) {
    const alterIds = system.alters?.IDs || [];
    const stateIds = system.states?.IDs || [];
    const groupIds = system.groups?.IDs || [];

    // Fetch all entities to clean their R2 media
    const [alters, states, groups] = await Promise.all([
        Alter.find({ _id: { $in: alterIds } }),
        State.find({ _id: { $in: stateIds } }),
        Group.find({ _id: { $in: groupIds } })
    ]);

    for (const entity of [...alters, ...states, ...groups]) {
        await deleteEntityR2Media(entity);
    }

    // Delete entity documents
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

    // Clean up system's own R2 media (theme background, mask background)
    await deleteEntityR2Media(system);

    // Clean up Redis keys for this system
    try {
        await redis.del(`system:${system._id}:recentProxies`);
        await redis.del(`system:${system._id}:break`);
        await redis.del(`system:${system._id}:lastProxyTime`);
    } catch (e) { /* Redis may be unavailable */ }

    // Delete display cache for all entities (main, server, mask variants)
    try {
        const allEntityIds = [...alterIds, ...stateIds, ...groupIds];
        for (const eid of allEntityIds) {
            // Delete main cache
            await redis.del(`display:${eid}:main`);
            // Scan and delete server/mask variants
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `display:${eid}:*`, 'COUNT', 100);
                cursor = nextCursor;
                for (const key of keys) {
                    await redis.del(key);
                }
            } while (cursor !== '0');
        }
    } catch (e) { /* Redis may be unavailable */ }
}

module.exports = {
    deleteEntityR2Media,
    cleanUserReferences,
    deleteUserNotes,
    deleteUserMessages,
    deleteSystemData
};
