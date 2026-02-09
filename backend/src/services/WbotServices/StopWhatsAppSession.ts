import { v4 as uuidv4 } from "uuid";
import { Envelope } from "../../microservice/contracts";
import { logger } from "../../utils/logger";
import RabbitMQService from "../RabbitMQService";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";

const StopWhatsAppSession = async (whatsappId: number): Promise<void> => {
    try {
        const whatsapp = await Whatsapp.findByPk(whatsappId);

        if (whatsapp) {
            await whatsapp.update({ status: "DISCONNECTED", qrcode: "" });

            const io = getIO();
            io.emit("whatsappSession", {
                action: "update",
                session: whatsapp
            });

            // SKIP IF WEBCHAT - No need to tell Engine Standard
            if (whatsapp.type === "webchat") {
                logger.info(`StopWhatsAppSession: Skipping engine command for Webchat session ${whatsappId}`);
                return;
            }
        }

        const envelope: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId: whatsapp?.tenantId || 1,
            type: "session.stop",
            payload: {
                sessionId: whatsappId
            }
        };

        // Use the routing key pattern wbot.tenantId.sessionId.engine.command
        await RabbitMQService.publishCommand(
            `wbot.${whatsapp?.tenantId || 1}.${whatsappId}.${whatsapp?.engineType || "whaileys"}.session.stop`,
            envelope
        );

        logger.info(`Session stop command published for WhatsApp ID ${whatsappId}`);

    } catch (err) {
        logger.error("Error publishing session.stop command", err);
    }
};

export default StopWhatsAppSession;
