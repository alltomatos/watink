import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  tenantId: number | string,
  groupContact?: Contact
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

  if (!ticket) {
    // Grupos: criar como 'open' (sempre prontos para resposta)
    // Individuais: criar como 'pending' (aguardando aceite)
    const ticketStatus = groupContact ? "open" : "pending";

    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: ticketStatus,
      isGroup: !!groupContact,
      unreadMessages,
      whatsappId,
      tenantId
    });
  }

  ticket = await ShowTicketService(ticket.id);

  return ticket;
};

export default FindOrCreateTicketService;
