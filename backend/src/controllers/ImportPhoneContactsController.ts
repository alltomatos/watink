import { Request, Response } from "express";
// import ImportContactsService from "../services/WbotServices/ImportContactsService";
import { v4 as uuidv4 } from "uuid";
import RabbitMQService from "../services/RabbitMQService";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import { logger } from "../utils/logger";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const userId: number = parseInt(req.user.id);
  // await ImportContactsService(userId);

  // New Async Logic
  try {
      const whatsapp = await GetDefaultWhatsApp(userId);
      const tenantId = whatsapp.tenantId;
      
      await RabbitMQService.publishCommand(`wbot.${tenantId}.${whatsapp.id}.contact.import`, {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "contact.import", // Need to ensure Engine handles this or create new type
        payload: {
            sessionId: whatsapp.id
        }
      });
      
      logger.info(`[ImportContacts] Command sent for user ${userId} / session ${whatsapp.id}`);

      return res.status(200).json({ message: "Contact import scheduled. This may take a while." });
  } catch (err) {
      logger.error(`[ImportContacts] Error: ${err}`);
      // Fallback if no default whatsapp
      return res.status(400).json({ error: "Could not schedule import. Ensure you have a connected WhatsApp." });
  }
};
