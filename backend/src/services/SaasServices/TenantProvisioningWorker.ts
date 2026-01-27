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

        // Invalidate Redis cache for this tenant
        // Example pattern: tenant:${tenantId}:*
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

        stream.on("end", async () => { // Added async here
            logger.info(`[TenantProvisioningWorker] Cache cleared for tenant ${msg.tenantId}`);

            // Disconnection logic based on the provided snippet
            if (msg.action === "provisioned") { // Corrected 'content' to 'msg'
                // The original snippet had 'await redisClient.del(cacheKey);' here,
                // but the cache for the tenant is already being cleared by the stream above.
                // If a specific cacheKey needs to be deleted, it should be defined.
                // For now, assuming the stream-based cache clearing is sufficient.
                logger.info(`[TenantProvisioningWorker] Processed 'provisioned' action for tenant ${msg.tenantId}`);

                // If status changed to inactive/suspended, disconnect sessions
                if (msg.status === "inactive" || msg.status === "suspended") { // Corrected 'content' to 'msg'
                    logger.info(`Tenant ${msg.tenantId} suspended. Disconnecting sessions...`); // Corrected 'tenantId' to 'msg.tenantId'
                    try {
                        const whatsapps = await Whatsapp.findAll({ where: { tenantId: msg.tenantId } }); // Corrected 'tenantId' to 'msg.tenantId'
                        for (const whatsapp of whatsapps) {
                            await StopWhatsAppSession(whatsapp.id);
                        }
                    } catch (err) {
                        logger.error(`Error disconnecting sessions for tenant ${msg.tenantId}: ${err}`); // Corrected 'tenantId' to 'msg.tenantId'
                    }
                }
            }
        });

        // If needed, update local database if the event contains new info that wasn't in DB yet?
        // But watink-guard inserts into DB. So here we just clear cache to ensure backend sees new data if it cached something (unlikely for new tenant, but good practice).
    });
};
