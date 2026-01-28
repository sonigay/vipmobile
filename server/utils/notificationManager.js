/**
 * Notification Manager
 * 
 * Manages Server-Sent Events (SSE) connections and Push Notifications.
 */

const webpush = require('web-push');

// Configure web-push if keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:example@yourdomain.org',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log('✅ [Notification] Push notification configured');
} else {
    console.warn('⚠️ [Notification] VAPID keys missing, push notifications disabled');
}

class NotificationManager {
    constructor() {
        this.connectedClients = new Map(); // Map<userId, { res, id }>
        this.pushSubscriptions = new Map(); // Map<userId, subscription>
    }

    /**
     * Add a new SSE client
     */
    addClient(userId, res) {
        const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // Store connection
        if (!this.connectedClients.has(userId)) {
            this.connectedClients.set(userId, new Map());
        }
        this.connectedClients.get(userId).set(clientId, res);

        console.log(`🔌 [Notification] Client connected: ${userId} (${clientId})`);

        // Remove client on close
        res.on('close', () => {
            if (this.connectedClients.has(userId)) {
                this.connectedClients.get(userId).delete(clientId);
                if (this.connectedClients.get(userId).size === 0) {
                    this.connectedClients.delete(userId);
                }
            }
            console.log(`🔌 [Notification] Client disconnected: ${userId} (${clientId})`);
        });

        return clientId;
    }

    /**
     * Send notification to specific users
     */
    sendToUsers(userIds, notification) {
        if (!Array.isArray(userIds)) userIds = [userIds];

        userIds.forEach(userId => {
            // 1. Send via SSE
            if (this.connectedClients.has(userId)) {
                this.connectedClients.get(userId).forEach(res => {
                    res.write(`data: ${JSON.stringify(notification)}\n\n`);
                });
            }

            // 2. Send via Push (Implementation simplified for now)
            // TODO: Implement Push Notification sending if subscription exists
        });
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(notification) {
        this.connectedClients.forEach((clients) => {
            clients.forEach(res => {
                res.write(`data: ${JSON.stringify(notification)}\n\n`);
            });
        });
    }
}

// Singleton instance
const notificationManager = new NotificationManager();

module.exports = notificationManager;
