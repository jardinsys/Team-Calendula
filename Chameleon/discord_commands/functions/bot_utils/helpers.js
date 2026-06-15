// Misc helpers extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

module.exports = {
    updateRecentProxies(system, entity, type) {
        const proxyKey = `${type}:${entity._id}`;
        if (!system.proxy) system.proxy = {};
        if (!system.proxy.recentProxies) system.proxy.recentProxies = [];
        system.proxy.recentProxies = system.proxy.recentProxies.filter((p) => !p.startsWith(proxyKey));
        system.proxy.recentProxies.unshift(proxyKey);
        system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
    },

    getBatteryEmoji(battery) {
        if (battery >= 70) return '🔋';
        if (battery >= 30) return '🪫';
        return '⚠️';
    },

    getAndClearNotifications(userId) {
        const notifications = notificationManager.getNotifications(userId);
        notificationManager.clearNotifications(userId);
        return notifications;
    },

    formatNotificationEmbed(notifications) {
        if (!notifications || notifications.length === 0) return null;

        const embed = new EmbedBuilder()
            .setColor('#00d4ff')
            .setTitle('📬 Notifications')
            .setFooter({ text: 'Type /settings to manage notifications' });

        const groupedByType = {};
        notifications.forEach((notif) => {
            if (!groupedByType[notif.type]) groupedByType[notif.type] = [];
            groupedByType[notif.type].push(notif.data);
        });

        if (groupedByType['friend-request']) {
            const requests = groupedByType['friend-request'];
            embed.addFields({
                name: '👥 Friend Requests',
                value: requests.map((r) => `• ${r.senderName} (@${r.senderId})`).join('\n') || 'None',
                inline: false,
            });
        }

        if (groupedByType['app-message']) {
            const messages = groupedByType['app-message'];
            embed.addFields({
                name: '💬 Messages from Sucre',
                value: messages.map((m) => `• ${m.message}`).join('\n') || 'None',
                inline: false,
            });
        }

        if (groupedByType['friend-switch']) {
            const switches = groupedByType['friend-switch'];
            embed.addFields({
                name: '🔄 Friend Switches',
                value: switches.map((s) => `• ${s.friendName} switched to ${s.switched}`).join('\n') || 'None',
                inline: false,
            });
        }

        return embed;
    },

    buildLogEmbed(eventType, data) {
        const color = '#ff4444';
        const title = `📋 ${eventType}`;
        // Keep this small and focused; expand only when needed.
        return new EmbedBuilder().setColor(color).setTitle(title);
    },
};
