import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../../models/Whatsapp";
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

    let commandType = "session.start";
    let exchange = "wbot.commands";
    let routingKey = `wbot.${whatsapp.tenantId}.${whatsapp.id}.session.start`;

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
        force
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
