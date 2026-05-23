const { EventEmitter } = require('events');

class NotificationManager extends EventEmitter {
  constructor() {
    super();
    this.notifications = new Map(); // userId -> array of notifications
    this.MAX_NOTIFICATIONS_PER_USER = 50;
  }

  addNotification(userId, type, data) {
    if (!userId || !type) return false;

    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }

    const userNotifications = this.notifications.get(userId);

    // Prevent unbounded growth
    if (userNotifications.length >= this.MAX_NOTIFICATIONS_PER_USER) {
      userNotifications.shift(); // Remove oldest
    }

    const notification = {
      type,
      data,
      timestamp: Date.now(),
    };

    userNotifications.push(notification);
    this.emit('notification', { userId, type, data });

    return true;
  }

  getNotifications(userId) {
    return this.notifications.get(userId) || [];
  }

  clearNotifications(userId) {
    this.notifications.delete(userId);
  }

  removeNotification(userId, index) {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications && index >= 0 && index < userNotifications.length) {
      userNotifications.splice(index, 1);
    }
  }

  hasNotifications(userId) {
    const notifs = this.notifications.get(userId);
    return notifs && notifs.length > 0;
  }

  // Clean up old notifications for a user (older than ttlMs)
  pruneOldNotifications(userId, ttlMs = 3600000) { // 1 hour default
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return;

    const now = Date.now();
    const filtered = userNotifications.filter(n => now - n.timestamp < ttlMs);

    if (filtered.length === 0) {
      this.notifications.delete(userId);
    } else {
      this.notifications.set(userId, filtered);
    }
  }
}

module.exports = new NotificationManager();
