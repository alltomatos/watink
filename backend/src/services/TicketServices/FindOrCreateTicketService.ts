import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Queue, { DISTRIBUTION_STRATEGIES } from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import TicketDistributionService from "./TicketDistributionService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  tenantId: number | string,
  groupContact?: Contact,
  queueId?: number
): Promise<Ticket> => {
  // Buscar ticket aberto ou pendente existente
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      tenantId,
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId
    }
  });

  if (ticket) {
    await ticket.update({ unreadMessages });
    return await ShowTicketService(ticket.id);
  }

  // Lógica removida: Mensagens antigas agora são tratadas no EventListener
  // e não criam tickets - apenas salvam no histórico se ticket existir


  // Para grupos: reabrir como 'open' (grupos sempre prontos para resposta)
  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        whatsappId: whatsappId,
        tenantId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "open", // Grupos sempre abertos
        unreadMessages
      });
    }
  }

  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        whatsappId: whatsappId,
        tenantId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages
      });
    }
  }

  let isNewTicket = false;

  if (!ticket) {
    // Grupos: criar como 'open' (sempre prontos para resposta)
    // Individuais: criar como 'pending' (aguardando aceite ou distribuição)
    const ticketStatus = groupContact ? "open" : "pending";

    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: ticketStatus,
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId,
      tenantId,
      queueId
    });

    isNewTicket = true;
  }

  // Auto-distribute new tickets (only for individual chats, not groups)
  if (isNewTicket && !groupContact && queueId) {
    try {
      const queue = await Queue.findByPk(queueId);

      if (queue && queue.distributionStrategy !== DISTRIBUTION_STRATEGIES.MANUAL) {
        const result = await TicketDistributionService.distributeTicket(ticket, queue);

        if (result.user) {
          await ticket.update({
            userId: result.user.id,
            status: "open"
          });

          logger.info(
            `[FindOrCreateTicket] Auto-distributed ticket ${ticket.id} - ${result.reason}`
          );

          // Emit socket event for real-time update
          const io = getIO();
          io.to("notification").emit("ticket", {
            action: "update",
            ticket: await ShowTicketService(ticket.id)
          });
        }
      }
    } catch (error) {
      logger.error(`[FindOrCreateTicket] Distribution failed for ticket ${ticket.id}:`, error);
      // Continue without distribution - ticket stays pending
    }
  }

  ticket = await ShowTicketService(ticket.id);

  return ticket;
};

export default FindOrCreateTicketService;

