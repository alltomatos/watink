import { v4 as uuidv4 } from "uuid";
import { Envelope, MarkAsReadPayload } from "../microservice/contracts";
import RabbitMQService from "../services/RabbitMQService";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  try {
    // 1. Find unread messages (received only, since we don't mark our own messages as read for ourselves)
    const unreadMessages = await Message.findAll({
      where: {
        ticketId: ticket.id,
        read: false,
        fromMe: false // Only mark received messages as read
      },
      attributes: ["id"]
    });

    const unreadMessageIds = unreadMessages.map(m => m.id);

    // 2. Update messages to read = true in DB
    if (unreadMessageIds.length > 0) {
      await Message.update(
        { read: true },
        {
          where: {
            ticketId: ticket.id,
            read: false
          }
        }
      );

      // 3. Publish command to Engine to mark as read in WhatsApp
      const markReadPayload: MarkAsReadPayload = {
        sessionId: ticket.whatsappId, // Assuming ticket has whatsappId
        to: `${ticket.contact.number} @${ticket.isGroup ? "g" : "c"}.us`,
        messageIds: unreadMessageIds
      };

      const command: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId: ticket.tenantId,
        type: "message.markAsRead",
        payload: markReadPayload
      };

      await RabbitMQService.publishCommand(
        `wbot.${ticket.tenantId}.${ticket.whatsappId}.message.markAsRead`,
        command
      );
    }

    // 4. Update ticket unread count
    await ticket.update({ unreadMessages: 0 });

  } catch (err) {
    logger.warn(
      `Could not mark messages as read.Err: ${err} `
    );
  }

  const io = getIO();
  io.to(ticket.status).to("notification").emit("ticket", {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
