import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";

/**
 * Gracefully restarts a WhatsApp session WITHOUT clearing auth files.
 * This allows reconnecting without requiring a new QR code scan.
 */
const RestartWhatsAppSession = async (whatsapp: Whatsapp): Promise<void> => {
    await whatsapp.update({ status: "OPENING" });
    logger.info(`RestartWhatsAppSession called for session ${whatsapp.id}`);

    const io = getIO();
    io.emit("whatsappSession", {
        action: "update",
        session: whatsapp
    });

    if (whatsapp.type === "webchat") {
        logger.info(`RestartWhatsAppSession: Skipping engine command for Webchat session ${whatsapp.id}`);
        return;
    }

    try {
        const command: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId: whatsapp.tenantId,
            type: "session.restart",
            payload: {
                sessionId: whatsapp.id,
                name: whatsapp.name,
                syncHistory: whatsapp.syncHistory,
                syncPeriod: whatsapp.syncPeriod,
                keepAlive: whatsapp.keepAlive
            }
        };

        await RabbitMQService.publishCommand(`wbot.${whatsapp.tenantId}.${whatsapp.id}.session.restart`, command);
        logger.info(`Session restart command published for session ${whatsapp.id}`);
    } catch (err) {
        logger.error(err);
    }
};

export default RestartWhatsAppSession;
