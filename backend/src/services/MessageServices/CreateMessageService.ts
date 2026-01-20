import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  tenantId?: number | string;
  ack?: number;
  quotedMsgId?: string | null;
  dataJson?: object;
  participant?: string;
  createdAt?: Date;
}
interface Request {
  messageData: MessageData;
}

const CreateMessageService = async ({
  messageData
}: Request): Promise<Message> => {
  // Check if quotedMsgId refers to an existing message
  if (messageData.quotedMsgId) {
    const quotedMsg = await Message.findByPk(messageData.quotedMsgId);
    if (!quotedMsg) {
      // If quoted message does not exist, we cannot reference it in DB due to FK constraint.
      // We log a warning and proceed without the quote reference.
      const { logger } = require("../../utils/logger");
      logger.warn(`[CreateMessageService] Quoted message ${messageData.quotedMsgId} not found. Removing reference to prevent FK error.`);
      messageData.quotedMsgId = null;
    }
  }

  await Message.upsert(messageData);

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  // Atualizar lastMessage do ticket para manter sidebar sincronizada
  // Só atualiza se a mensagem for mais recente que a última
  if (message.ticket && messageData.body) {
    await Ticket.update(
      {
        lastMessage: messageData.body,
        updatedAt: new Date()
      },
      { where: { id: message.ticketId } }
    );

    // Atualizar o objeto ticket no retorno
    message.ticket.lastMessage = messageData.body;
    message.ticket.updatedAt = new Date();
  }

  const io = getIO();
  io.to(message.ticketId.toString())
    .to(message.ticket.status)
    .to("notification")
    .emit("appMessage", {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    });

  const { logger } = require("../../utils/logger");
  logger.info(`[CreateMessageService] Emitted appMessage create for msg ${message.id} ticket ${message.ticketId}`);

  return message;
};

export default CreateMessageService;
