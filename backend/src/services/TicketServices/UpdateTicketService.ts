import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Setting from "../../models/Setting";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import EmbeddingService from "../AIServices/EmbeddingService";
import { logger } from "../../utils/logger";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  await ticket.update({
    status,
    queueId,
    userId
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  await ticket.reload();

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    });

  // TRIGGER: Process embeddings when ticket is closed (async, non-blocking)
  if (status === "closed" && oldStatus !== "closed" && !ticket.isGroup) {
    // Run async to not block the response
    (async () => {
      try {
        // Check if AI is enabled for this tenant
        const [aiEnabled, aiAssistantEnabled] = await Promise.all([
          Setting.findOne({ where: { key: "aiEnabled", tenantId: ticket.tenantId } }),
          Setting.findOne({ where: { key: "aiAssistantEnabled", tenantId: ticket.tenantId } })
        ]);

        if (aiEnabled?.value === "true" && aiAssistantEnabled?.value === "true") {
          logger.info(`Processing embeddings for closed ticket #${ticket.id}`);
          await EmbeddingService.processTicket(ticket.id, ticket.tenantId as string);
          logger.info(`Embeddings processed successfully for ticket #${ticket.id}`);
        }
      } catch (error) {
        logger.error(`Error processing embeddings for ticket #${ticket.id}:`, error);
      }
    })();
  }

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
