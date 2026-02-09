import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";

import { QueryTypes } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const ShowWhatsAppService = async (id: string | number): Promise<Whatsapp & { messagesSent: number; messagesReceived: number }> => {
  const whatsapp = await Whatsapp.findByPk(id, {
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"]
      }
    ],
    order: [["queues", "name", "ASC"]]
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // Calculate message counts
  // We need to join with Tickets to filter by whatsappId
  const sentCount = await Message.count({
    include: [{
      model: Ticket,
      where: { whatsappId: id },
      attributes: []
    }],
    where: { fromMe: true }
  });

  const receivedCount = await Message.count({
    include: [{
      model: Ticket,
      where: { whatsappId: id },
      attributes: []
    }],
    where: { fromMe: false }
  });

  // Convert to JSON and append counts
  const whatsappData = whatsapp.toJSON() as Whatsapp & { messagesSent: number; messagesReceived: number };
  whatsappData.messagesSent = sentCount;
  whatsappData.messagesReceived = receivedCount;

  return whatsappData as any;
};

export default ShowWhatsAppService;
