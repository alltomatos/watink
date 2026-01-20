import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId
}: Request): Promise<Ticket> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  await CheckContactOpenTickets(contactId, defaultWhatsapp.id);

  const { isGroup, tenantId } = await ShowContactService(contactId);

  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  // Use Model.create instead of deprecated wbot.$create injection
  const ticket = await Ticket.create({
    contactId,
    status,
    isGroup,
    userId,
    queueId,
    whatsappId: defaultWhatsapp.id,
    tenantId: tenantId || defaultWhatsapp.tenantId
  });

  await ticket.reload({
    include: ["contact", "user", "queue", "whatsapp"]
  });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  return ticket;
};

export default CreateTicketService;
