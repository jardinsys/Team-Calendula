// User Routes
// Account management: wipe data, delete account

const express = require('express');
const router = express.Router();


const System = require('../../schemas/system');
const User = require('../../schemas/user');
const { deleteEntityR2Media, cleanUserReferences, deleteUserNotes, deleteUserMessages, deleteSystemData } = require('../utils/cascade');

// ===========================================
// POST /api/user/wipe
// Wipe data: delete notes + messages, keep system
// Body: { confirm: true, keepFriends: boolean }
// ===========================================

// TODO: Require 2FA verification before wipe
router.post('/wipe', async (req, res) => {
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
router.delete('/account', async (req, res) => {
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
                // Single-user system: full cascade via shared utility
                await deleteSystemData(system);
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

// ===========================================
// PATCH /api/user/settings
// Update user notification settings
// Body: { notificationPreferences?: { friendRequests?, friendSwitches?, appMessages? }, allowPing? }
// ===========================================

router.patch('/settings', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { notificationPreferences, allowPing } = req.body;

        if (notificationPreferences) {
            user.settings = user.settings || {};
            user.settings.notificationPreferences = user.settings.notificationPreferences || {};
            if (notificationPreferences.friendRequests !== undefined) {
                user.settings.notificationPreferences.friendRequests = notificationPreferences.friendRequests;
            }
            if (notificationPreferences.friendSwitches !== undefined) {
                user.settings.notificationPreferences.friendSwitches = notificationPreferences.friendSwitches;
            }
            if (notificationPreferences.appMessages !== undefined) {
                user.settings.notificationPreferences.appMessages = notificationPreferences.appMessages;
            }
        }

        if (allowPing !== undefined) {
            user.settings = user.settings || {};
            user.settings.allowPing = allowPing;
        }

        await user.save();

        res.json({
            settings: user.settings
        });
    } catch (err) {
        console.error('[User] Settings update error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
