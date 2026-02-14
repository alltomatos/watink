import fs from "fs";
import path from "path";
import uploadConfig from "../../config/upload";
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
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
  mentionedIds?: string[];
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  mentionedIds
}: Request): Promise<Message> => {
  try {
    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    // Read file and convert to base64
    const fileData = fs.readFileSync(media.path, { encoding: "base64" });

    // Move file to tenant folder
    const tenantFolder = path.join(uploadConfig.directory, ticket.tenantId.toString());
    if (!fs.existsSync(tenantFolder)) {
      fs.mkdirSync(tenantFolder, { recursive: true });
    }
    const newPath = path.join(tenantFolder, media.filename);
    fs.renameSync(media.path, newPath);

    // Sanitize number to ensure only digits
    const contactNumber = ticket.contact.number.replace(/\D/g, "");

    const messageData = {
      id: GenerateWAMessageId(),
      ticketId: ticket.id,
      contactId: undefined,
      body: body || media.originalname,
      fromMe: true,
      mediaType: media.mimetype.split("/")[0],
      read: true,
      quotedMsgId: undefined,
      ack: 0, // Pending
      timestamp: new Date().getTime(),
      mediaUrl: `${ticket.tenantId}/${media.filename}`,
      tenantId: ticket.tenantId
    };

    const message = await Message.create(messageData);

    const io = getIO();
    io.to(message.ticketId.toString()).emit("appMessage", {
      action: "create",
      message,
      ticket: ticket,
      contact: ticket.contact
    });

    const command: Envelope = {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId: ticket.tenantId,
      type: "message.send.media",
      payload: {
        sessionId: ticket.whatsappId,
        messageId: message.id,
        to: `${contactNumber}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        lid: ticket.contact.lid || undefined,
        caption: hasBody,
        mentions: mentionedIds,
        media: {
          mimetype: media.mimetype,
          filename: media.originalname,
          data: fileData
        }
      }
    };

    await RabbitMQService.publishCommand(
      `wbot.${ticket.tenantId}.${ticket.whatsappId}.message.send.media`,
      command
    );

    await ticket.update({ lastMessage: body || media.originalname });

    return message;
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
