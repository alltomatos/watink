import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../../models/Whatsapp";
import Plugin from "../../models/Plugin";
import PluginInstallation from "../../models/PluginInstallation";
import Setting from "../../models/Setting";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";
import { RedisService } from "../RedisService";
import AppError from "../../errors/AppError";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  usePairingCode?: boolean,
  phoneNumber?: string,
  force?: boolean // New param
): Promise<void> => {

  // REDIS LOCK IMPLEMENTATION
  const redis = RedisService.getInstance();
  const lockKey = `session:start:${whatsapp.id}`;
  const lockValue = uuidv4();

  // Try to acquire lock for 10 seconds to prevent double-starts from UI Spam
  const acquired = await redis.setNx(lockKey, lockValue, 10);

  if (!acquired) {
    logger.warn(`StartWhatsAppSession: Blocked double start attempt for session ${whatsapp.id}`);
    throw new AppError("ERR_SESSION_STARTING_ALREADY", 400);
  }

  try {
    await whatsapp.update({ status: "OPENING" });
    logger.info(`StartWhatsAppSession called for session ${whatsapp.id} (Type: ${whatsapp.type})`);

    const io = getIO();
    io.emit("whatsappSession", {
      action: "update",
      session: whatsapp
    });

    const sessionInstanceId = Date.now(); // Unique ID for this session instance

    // PAPI ENGINE PLUGIN CHECK
    let papiUrl: string | undefined;
    let papiKey: string | undefined;

    if (whatsapp.engineType === "papi") {
      logger.info(`StartWhatsAppSession: Checking PAPI plugin status for tenant ${whatsapp.tenantId}`);
      const plugin = await Plugin.findOne({ where: { slug: "engine-papi" } });
      if (plugin) {
        const installation = await PluginInstallation.findOne({
          where: {
            pluginId: plugin.id,
            tenantId: whatsapp.tenantId,
            status: "active"
          }
        });

        if (!installation) {
          logger.warn(`StartWhatsAppSession: PAPI plugin found but not active for tenant ${whatsapp.tenantId}`);
          throw new AppError("ERR_PLUGIN_NOT_ACTIVE_PAPI", 403);
        }

        logger.info(`StartWhatsAppSession: PAPI plugin active. Fetching settings.`);
        // Fetch settings for PAPI
        const urlSetting = await Setting.findOne({ where: { key: "papiUrl", tenantId: whatsapp.tenantId } });
        const keySetting = await Setting.findOne({ where: { key: "papiKey", tenantId: whatsapp.tenantId } });

        papiUrl = urlSetting?.value;
        papiKey = keySetting?.value;

        if (!papiUrl) {
          logger.error(`StartWhatsAppSession: papiUrl setting missing for tenant ${whatsapp.tenantId}`);
          throw new AppError("ERR_PAPI_URL_NOT_CONFIGURED", 400);
        }
      }
      logger.info(`StartWhatsAppSession: PAPI settings loaded. URL provided: ${!!papiUrl}, Key provided: ${!!papiKey}`);
    } else {
      logger.warn(`StartWhatsAppSession: PAPI engine selected but 'engine-papi' plugin not found in DB.`);
    }

    // [NEW] Auto-configure Webhook URL based on Frontend/App Domain
    // The engine-papi is exposed via Traefik at /plugins/papi
    const appDomain = process.env.FRONTEND_URL || "http://app.localhost";
    // Ensure no trailing slash
    const cleanDomain = appDomain.endsWith("/") ? appDomain.slice(0, -1) : appDomain;
    const papiWebhookUrl = `${cleanDomain}/plugins/papi/webhook`;

    let commandType = "session.start";
    let exchange = "wbot.commands";

    let routingKey = `wbot.${whatsapp.tenantId}.${whatsapp.id}.${whatsapp.engineType || "whaileys"}.session.start`;

    // WEBCHAT ROUTING LOGIC
    if (whatsapp.type === "webchat") {
      commandType = "webchat.session.start";
      exchange = "webchat.commands";
      routingKey = `webchat.${whatsapp.tenantId}.${whatsapp.id}.session.start`;
      logger.info(`Routing session ${whatsapp.id} to Webchat Engine`);
    }

    const command: Envelope = {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId: whatsapp.tenantId,
      type: commandType,
      payload: {
        sessionId: whatsapp.id,
        sessionInstanceId, // [NEW] Unique ID
        usePairingCode,
        phoneNumber,
        name: whatsapp.name,
        syncHistory: whatsapp.syncHistory,
        syncPeriod: whatsapp.syncPeriod,
        keepAlive: whatsapp.keepAlive,
        webchatId: whatsapp.id, // For webchat handler compatibility
        force,
        papiUrl,
        papiKey,
        webhookUrl: papiWebhookUrl // [NEW] Pass auto-generated webhook URL
      }
    };

    await RabbitMQService.publishCommand(routingKey, command, exchange);
    logger.info(`Session start command published for session ${whatsapp.id} (Instance: ${sessionInstanceId})`);

  } catch (err) {
    // Release lock on error
    await redis.delValue(lockKey);
    logger.error(err);
    // Re-throw if needed, or let controller handle it.
    // Since this function is void and async, throwing here might be caught by Controller.
    throw err;
  }
  // Note: We do NOT release the lock immediately on success, we let it expire (TTL 10s)
  // to act as a debounce buffer for the "Start" button.
};
