// Privacy and visibility extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

const System = require('../../../schemas/system');
const User = require('../../../schemas/user');

function getPrivacyBucket(system, viewerDiscordId, viewerFriendId) {
    if (!system?.privacyBuckets) return null;

    for (const bucket of system.privacyBuckets) {
        const inBucket = bucket.friends?.some(f =>
            f.discordUserID === viewerDiscordId || f.friendID === viewerFriendId
        );
        if (inBucket) return bucket;
    }

    // Not in any bucket — return the Default bucket (minimal visibility)
    const defaultBucket = system.privacyBuckets.find(b => b.name === 'Strangers');
    return defaultBucket || null;
}

function shouldShowEntity(entity, privacyBucket, isOwner, showFullList = false) {
    if (isOwner) return true;
    if (!privacyBucket) return false;

    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);

    // No privacy entry for this bucket — hide by default (minimal visibility)
    if (!entityPrivacy) return false;
    if (entityPrivacy?.settings?.hidden === true) return false;

    return true;
}

async function isPingAllowed(entity, pingedUserId, viewerDiscordId) {
    // 1. Check entity-level master toggle
    if (entity.setting?.allowPing === false) return false;

    // 2. Get the entity's owner system and user
    const system = await System.findById(entity.systemID);
    if (!system) return false;

    const ownerUser = await User.findOne({ systemID: system._id.toString() });
    if (!ownerUser) return false;

    // 3. Check user-level master toggle
    if (ownerUser.settings?.allowPing === false) return false;

    // 4. Check privacy bucket restriction (only applies to friends, not strangers)
    const privacyBucket = getPrivacyBucket(system, viewerDiscordId);
    if (privacyBucket) {
        const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);
        if (entityPrivacy?.settings?.allowPing === false) return false;
    }

    return true;
}

function isBlocked(targetUser, viewerDiscordId, viewerFriendId) {
    if (!targetUser?.blocked) return false;
    return targetUser.blocked.some(b =>
        b.discordID === viewerDiscordId || b.friendID === viewerFriendId
    );
}

module.exports = {
    getPrivacyBucket,
    shouldShowEntity,
    isPingAllowed,
    isBlocked,
};
