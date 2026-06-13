// Switch notification system with debounce
// Sends DMs to friends when a system switches front

const User = require('../../schemas/user');
const System = require('../../schemas/system');

// Debounce timers: systemId → { timeout, frontSnapshot }
const debounceTimers = new Map();
const DEFAULT_DEBOUNCE_MS = 10 * 1000; // 10 seconds

/**
 * Send friend switch notifications for a system.
 * Implements a 10-second debounce buffer — if another switch happens
 * within the window, only the final front state is notified.
 *
 * @param {Object} system - The system document
 * @param {Object} client - Discord client (for DM delivery)
 */
async function sendFriendSwitchNotifications(system, client) {
    if (!system?.users?.length) return;

    const systemId = system._id.toString();

    // Check if debounce is already active
    if (debounceTimers.has(systemId)) {
        // Update snapshot and reset timer
        const existing = debounceTimers.get(systemId);
        clearTimeout(existing.timeout);
        existing.frontSnapshot = buildFrontSnapshot(system);
        existing.timeout = setTimeout(() => flushNotification(systemId, client), DEFAULT_DEBOUNCE_MS);
        return;
    }

    // Start new debounce timer
    const entry = {
        frontSnapshot: buildFrontSnapshot(system),
        timeout: setTimeout(() => flushNotification(systemId, client), DEFAULT_DEBOUNCE_MS)
    };
    debounceTimers.set(systemId, entry);
}

/**
 * Build a snapshot of the current front state for notification
 */
function buildFrontSnapshot(system) {
    const fronters = [];
    for (const layer of (system.front?.layers || [])) {
        for (const shiftId of (layer.shifts || [])) {
            // Shifts are ObjectId refs — we need the actual shift data
            // For the snapshot, we store layer name and shift IDs
            // The actual shift resolution happens when sending
            fronters.push({ layerId: layer._id, layerName: layer.name, shiftId });
        }
    }
    return {
        fronters,
        status: system.front?.status || null,
        battery: system.battery ?? null
    };
}

/**
 * Flush the debounced notification — resolve shifts and send DMs
 */
async function flushNotification(systemId, client) {
    debounceTimers.delete(systemId);

    try {
        const system = await System.findById(systemId);
        if (!system) return;

        // Resolve fronting entities from active shifts
        const { Shift } = require('../../schemas/front');
        const frontingEntities = [];

        for (const layer of (system.front?.layers || [])) {
            for (const shiftId of (layer.shifts || [])) {
                const shift = await Shift.findById(shiftId);
                if (!shift || shift.endTime) continue; // skip closed shifts

                const EntityModel = shift.s_type === 'alter' ? require('../../schemas/alter')
                    : shift.s_type === 'state' ? require('../../schemas/state')
                    : require('../../schemas/group');
                const entity = await EntityModel.findById(shift.ID);
                if (!entity) continue;

                frontingEntities.push({
                    name: entity.name?.display || entity.name?.indexable || 'Unknown',
                    type: shift.s_type,
                    layer: layer.name
                });
            }
        }

        if (frontingEntities.length === 0) return;

        // Find all friends who have friendSwitches enabled
        const users = await Promise.all(
            system.users.map(uid => User.findById(uid))
        );

        for (const user of users) {
            if (!user?.friends?.length) continue;

            const notifPrefs = user.settings?.notificationPreferences || {};
            if (notifPrefs.friendSwitches === false) continue;

            const deliveryMethod = notifPrefs.friendNotifications || 'dm';

            for (const friend of user.friends) {
                if (!friend.discordID) continue;

                // Check per-friend notification toggle (default: true)
                if (friend.notifyOnSwitch === false) continue;

                // Check if this friend has their own system and what their notification prefs are
                const friendUser = await User.findOne({ discordID: friend.discordID });
                if (!friendUser) continue;

                const friendPrefs = friendUser.settings?.notificationPreferences || {};
                if (friendPrefs.friendSwitches === false) continue;

                const friendDelivery = friendPrefs.friendNotifications || 'dm';

                // Build notification text
                const names = frontingEntities.map(e => {
                    const emoji = e.type === 'alter' ? '🎭' : e.type === 'state' ? '🔄' : '👥';
                    return `${emoji} ${e.name}`;
                }).join(', ');

                const systemName = system.name?.display || system.name?.indexable || 'A system';
                const text = `🔄 **${systemName}** switched — now fronting: ${names}`;

                if (friendDelivery === 'dm') {
                    try {
                        const discordUser = await client.users.fetch(friend.discordID);
                        if (discordUser) {
                            await discordUser.send({ content: text });
                        }
                    } catch (e) {
                        // DMs closed or user not found — skip silently
                    }
                }
                // 'command' and 'none' delivery methods don't send proactive DMs
                // For 'command', the friend sees notifications when they run /friend commands
            }
        }
    } catch (err) {
        console.error('[SwitchNotify] Error sending notifications:', err.message);
    }
}

/**
 * Cancel a pending debounce (e.g., when system is deleted)
 */
function cancelDebounce(systemId) {
    const entry = debounceTimers.get(systemId);
    if (entry) {
        clearTimeout(entry.timeout);
        debounceTimers.delete(systemId);
    }
}

module.exports = { sendFriendSwitchNotifications, cancelDebounce };
