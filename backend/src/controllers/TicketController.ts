import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { v4 as uuidv4 } from "uuid";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CloseAllTicketsService from "../services/TicketServices/CloseAllTicketsService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import RabbitMQService from "../services/RabbitMQService";
import { Envelope } from "../microservice/contracts";
import Message from "../models/Message";
import Contact from "../models/Contact";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  isGroup: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  tags?: number[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    withUnreadMessages,
    isGroup
  } = req.query as IndexQuery;

  const userId = req.user.id;

  let queueIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    isGroup,
    tenantId: req.user.tenantId
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId }: TicketData = req.body;

  const ticket = await CreateTicketService({ contactId, status, userId });

  const io = getIO();
  io.to(ticket.status).emit("ticket", {
    action: "update",
    ticket
  });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const contact = await ShowTicketService(ticketId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId
  });

  if (ticket.status === "closed") {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId);

    const { farewellMessage } = whatsapp;

    if (farewellMessage) {
      await SendWhatsAppMessage({
        body: formatBody(farewellMessage, ticket.contact),
        ticket
      });
    }
  }

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  const ticket = await DeleteTicketService(ticketId);

  const io = getIO();
  io.to(ticket.status).to(ticketId).to("notification").emit("ticket", {
    action: "delete",
    ticketId: +ticketId
  });

  return res.status(200).json({ message: "ticket deleted" });
};

// Novo: Buscar histórico de mensagens sob demanda
export const syncHistory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { fromDate, toDate } = req.body;
  const { tenantId } = req.user;

  if (!fromDate) {
    throw new AppError("ERR_DATE_REQUIRED", 400);
  }

  const ticket = await Ticket.findByPk(ticketId, {
    include: ["contact", "whatsapp"]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (!ticket.whatsapp || ticket.whatsapp.status !== "CONNECTED") {
    throw new AppError("ERR_WHATSAPP_NOT_CONNECTED", 400);
  }

  const contactNumber = ticket.contact?.number || ticket.contact?.lid || "";

  if (!contactNumber) {
    throw new AppError("ERR_NO_CONTACT_NUMBER", 400);
  }

  const command: Envelope = {
    id: uuidv4(),
    timestamp: Date.now(),
    tenantId,
    type: "history.sync",
    payload: {
      sessionId: ticket.whatsappId,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      contactNumber,
      fromDate,
      toDate: toDate || new Date().toISOString()
    }
  };

  await RabbitMQService.publishCommand(
    `wbot.${tenantId}.${ticket.whatsappId}.history.sync`,
    command
  );

  return res.status(202).json({
    message: "Sincronização de histórico iniciada",
    ticketId: ticket.id
  });
};

export const closeAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const userId = Number(req.user.id);
  const { statusOpen, statusPending, includeGroups } = req.body;

  const closedCount = await CloseAllTicketsService({
    tenantId,
    userId,
    statusOpen,
    statusPending,
    includeGroups
  });

  return res.status(200).json({ closedCount });
};

export const showParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  // Find distinct contacts who sent messages in this ticket
  const messages = await Message.findAll({
    where: { ticketId },
    attributes: ["contactId"],
    group: ["contactId"]
  });

  const contactIds = messages.map(m => m.contactId);

  const participants = await Contact.findAll({
    where: {
      id: contactIds
    },
    attributes: ["id", "name", "number", "profilePicUrl"]
  });

  return res.status(200).json(participants);
};
