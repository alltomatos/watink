import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Step from "../../models/Step";
import Setting from "../../models/Setting";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import EmbeddingService from "../AIServices/EmbeddingService";
import EntityTagService from "../TagServices/EntityTagService";
import { logger } from "../../utils/logger";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
  stepId?: number;
  tags?: number[];
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
  const { status, userId, queueId, whatsappId, stepId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;
  const oldStepId = ticket.stepId;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  // Build update object
  const updateData: Partial<Ticket> = {};
  if (status !== undefined) updateData.status = status;
  if (queueId !== undefined) updateData.queueId = queueId;
  if (userId !== undefined) updateData.userId = userId;
  if (stepId !== undefined) updateData.stepId = stepId;

  await ticket.update(updateData);

  if (ticketData.tags) {
    await EntityTagService.SyncEntityTags({
      tagIds: ticketData.tags,
      entityType: "ticket",
      entityId: ticket.id,
      tenantId: ticket.tenantId as string
    });
  }

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  const ticketUpdated = await ShowTicketService(ticket.id);

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
      ticket: ticketUpdated
    });

  // TRIGGER: Wallet binding when moving to a binding step
  if (stepId !== undefined && stepId !== oldStepId && userId) {
    (async () => {
      try {
        const newStep = await Step.findByPk(stepId);

        if (newStep?.isBindingStep) {
          // Check if contact already has a wallet owner
          const contact = await Contact.findByPk(ticket.contactId);

          if (contact && !contact.walletUserId) {
            // Bind contact to the user who moved the ticket
            await contact.update({ walletUserId: userId });

            logger.info(
              `[WalletBinding] Contact ${contact.id} bound to user ${userId} via step "${newStep.name}"`
            );
          }
        }
      } catch (error) {
        logger.error(`Error in wallet binding trigger for ticket #${ticket.id}:`, error);
      }
    })();
  }

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

