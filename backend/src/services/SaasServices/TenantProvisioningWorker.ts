import RabbitMQService from "../RabbitMQService";
import { logger } from "../../utils/logger";
import Redis from "ioredis";
import Whatsapp from "../../models/Whatsapp";
import StopWhatsAppSession from "../WbotServices/StopWhatsAppSession";

interface TenantProvisionedEvent {
    tenantId: string;
    externalId: string;
    plan: string;
    status: string;
    action: string;
}

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export const TenantProvisioningWorker = async () => {
    logger.info("[TenantProvisioningWorker] Started");

    await RabbitMQService.consumeQueue("saas.tenant_provisioned", async (msg: TenantProvisionedEvent) => {
        logger.info(`[TenantProvisioningWorker] Received event for tenant ${msg.tenantId}`);

        // 1. Invalidate Redis cache for this tenant
        // Example pattern: tenant:${tenantId}:*
        // Using scanStream to find and delete keys efficiently without blocking Redis
        const stream = redis.scanStream({
            match: `tenant:${msg.tenantId}:*`
        });

        stream.on("data", (keys: string[]) => {
            if (keys.length) {
                const pipeline = redis.pipeline();
                keys.forEach((key) => {
                    pipeline.del(key);
                });
                pipeline.exec();
            }
        });

        stream.on("end", async () => {
            logger.info(`[TenantProvisioningWorker] Cache clearing initiated for tenant ${msg.tenantId}`);
        });

        // 2. Handle Status Changes (Suspension/Activation)
        if (msg.action === "provisioned") {
            // If status changed to inactive/suspended, disconnect sessions
            if (msg.status === "inactive" || msg.status === "suspended") {
                logger.info(`[TenantProvisioningWorker] Tenant ${msg.tenantId} is now ${msg.status}. Force disconnecting sessions...`);
                try {
                    const whatsapps = await Whatsapp.findAll({ where: { tenantId: msg.tenantId } });
                    
                    if (whatsapps.length > 0) {
                        for (const whatsapp of whatsapps) {
                            logger.info(`[TenantProvisioningWorker] Disconnecting session ${whatsapp.id} for tenant ${msg.tenantId}`);
                            await StopWhatsAppSession(whatsapp.id);
                        }
                    } else {
                        logger.info(`[TenantProvisioningWorker] No active sessions found for tenant ${msg.tenantId}`);
                    }
                } catch (err) {
                    logger.error(`[TenantProvisioningWorker] Error disconnecting sessions for tenant ${msg.tenantId}: ${err}`);
                }
            } else {
                 logger.info(`[TenantProvisioningWorker] Tenant ${msg.tenantId} status is ${msg.status}. No forced disconnection needed.`);
            }
        }
    });
};
