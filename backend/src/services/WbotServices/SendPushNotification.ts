import DeviceToken from "../../models/DeviceToken";

interface PushMessage {
    userId: number;
    tenantId: number;
    title: string;
    body: string;
}

export const SendPushNotification = async ({
    userId,
    tenantId,
    title,
    body
}: PushMessage): Promise<void> => {
    // TODO: Initialize Firebase Admin SDK here or in a centralized App config
    // import * as admin from 'firebase-admin';
    // if (!admin.apps.length) { admin.initializeApp({...}) }

    console.log(`[Push Notification] Sending to User ${userId} (Tenant ${tenantId}): ${title} - ${body}`);

    try {
        const devices = await DeviceToken.findAll({
            where: { userId, tenantId }
        });

        if (!devices.length) {
            console.log(`[Push Notification] No devices found for User ${userId}`);
            return;
        }

        const tokens = devices.map(d => d.token);

        // TODO: Send via Firebase Multicast
        // await admin.messaging().sendMulticast({
        //   tokens,
        //   notification: { title, body },
        //   data: { click_action: "FLUTTER_NOTIFICATION_CLICK" }
        // });

        console.log(`[Push Notification] Would send to ${tokens.length} devices.`);
    } catch (err) {
        console.error(`[Push Notification] Error:`, err);
    }
};
