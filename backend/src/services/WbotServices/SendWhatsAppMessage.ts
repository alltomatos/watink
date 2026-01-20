import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import formatBody from "../../helpers/Mustache";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";
import Message from "../../models/Message";
import { getIO } from "../../libs/socket";
import GenerateWAMessageId from "../../helpers/GenerateWAMessageId";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: any;
  mentionedIds?: string[];
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  mentionedIds
}: Request): Promise<any> => {
  try {
    const formattedBody = formatBody(body, ticket.contact);

    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_WRONG_WHATSAPP_ID");
    }

    // Sanitize number to ensure only digits
    const contactNumber = ticket.contact.number.replace(/\D/g, "");

    const messageData = {
      id: GenerateWAMessageId(),
      ticketId: ticket.id,
      contactId: undefined,
      body: formattedBody,
      fromMe: true,
      mediaType: "chat",
      read: true,
      quotedMsgId: quotedMsg?.id,
      ack: 0, // Pending
      timestamp: new Date().getTime(),
      tenantId: ticket.tenantId
    };

    const message = await Message.create(messageData);

    const messageComplete = await Message.findByPk(message.id, {
      include: [
        { model: Ticket, as: "ticket" },
        { model: Message, as: "quotedMsg", include: ["contact"] }
      ]
    });

    const io = getIO();
    io.to(message.ticketId.toString()).emit("appMessage", {
      action: "create",
      message: messageComplete || message,
      ticket: ticket,
      contact: ticket.contact
    });

    const command: Envelope = {
      id: uuidv4(), // Envelope ID
      timestamp: Date.now(),
      tenantId: ticket.tenantId,
      type: "message.send.text",
      payload: {
        sessionId: ticket.whatsappId,
        messageId: message.id, // Passing the created message ID
        to: `${contactNumber}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        lid: ticket.contact.lid || undefined, // Pass LID if available
        body: formattedBody,
        mentions: mentionedIds,
        options: {
          quotedMsgId: quotedMsg?.id,
          quoted: quotedMsg ? {
            key: {
              id: quotedMsg.id,
              fromMe: quotedMsg.fromMe,
              participant: quotedMsg.isGroup ? quotedMsg.participant || quotedMsg.contact?.number + "@s.whatsapp.net" : undefined
            },
            message: quotedMsg.dataJson // Optional but helpful
          } : undefined
        }
      }
    };

    await RabbitMQService.publishCommand(
      `wbot.${ticket.tenantId}.${ticket.whatsappId}.message.send.text`,
      command
    );

    await ticket.update({ lastMessage: body });

    return message;
  } catch (err) {
    const { logger } = require("../../utils/logger");
    logger.error(`[SendWhatsAppMessage] Error sending message: ticketId=${ticket.id} isGroup=${ticket.isGroup}`);
    logger.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
