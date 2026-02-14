import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import RabbitMQService from "../services/RabbitMQService";
import { Envelope, MessageReceivedPayload } from "../microservice/contracts";

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || whatsapp.type !== "webchat") {
    return res.status(404).json({ error: "Webchat not found" });
  }

  return res.json({
    name: whatsapp.name,
    greetingMessage: whatsapp.greetingMessage,
    farewellMessage: whatsapp.farewellMessage,
    chatConfig: whatsapp.chatConfig
  });
};

export const createTicket = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { name, email, phone, message } = req.body;

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || whatsapp.type !== "webchat") {
    return res.status(404).json({ error: "Webchat not found" });
  }

  // Find or Create Contact
  let contact = await Contact.findOne({ where: { email, tenantId: whatsapp.tenantId } });
  
  if (!contact) {
      const number = phone || `webchat-${Date.now()}`;
      contact = await Contact.create({
          name,
          number,
          email,
          tenantId: whatsapp.tenantId,
          isGroup: false
      });
  }

  // Find or Create Ticket
  const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id,
      1, // unreadMessages
      whatsapp.tenantId
  );

  // Update Ticket status to open if needed
  if (ticket.status === "closed") {
      await ticket.update({ status: "pending" });
  }

  // Send initial message from user via RabbitMQ
  if (message) {
      const messageId = uuidv4();
      const payload: MessageReceivedPayload = {
          sessionId: whatsapp.id,
          message: {
              id: messageId,
              from: contact.number,
              to: whatsapp.number || "",
              body: message,
              fromMe: false,
              isGroup: false,
              type: "chat",
              timestamp: Date.now() / 1000,
              hasMedia: false,
              participant: contact.number,
              profilePicUrl: contact.profilePicUrl,
              pushName: contact.name,
          }
      };

      const envelope: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: whatsapp.tenantId,
          type: "message.received",
          payload
      };

      await RabbitMQService.publishEvent(
          `wbot.${whatsapp.tenantId}.${whatsapp.id}.message.received`,
          envelope
      );
  }

  return res.json({ ticketId: ticket.id, contactId: contact.id });
};

import ListMessagesService from "../services/MessageServices/ListMessagesService";

export const listMessages = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { contactId, pageNumber } = req.query as { contactId: string, pageNumber: string };

  const ticket = await ShowTicketService(ticketId);

  if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
  }

  // Security check: ensure ticket belongs to the contact claiming it
  if (ticket.contactId !== Number(contactId)) {
      return res.status(403).json({ error: "Unauthorized" });
  }

  const { count, messages, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId
  });

  return res.json({ count, messages, hasMore });
};

export const saveMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body } = req.body;

  const ticket = await ShowTicketService(ticketId);
  
  if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
  }

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  if (!whatsapp) {
      return res.status(404).json({ error: "Whatsapp not found" });
  }

  // ShowTicketService returns ticket with contact included
  const contact = ticket.contact;

  const messageId = uuidv4();
  const payload: MessageReceivedPayload = {
      sessionId: whatsapp.id,
      message: {
          id: messageId,
          from: contact.number,
          to: whatsapp.number || "",
          body: body,
          fromMe: false,
          isGroup: false,
          type: "chat",
          timestamp: Date.now() / 1000,
          hasMedia: false,
          participant: contact.number,
          profilePicUrl: contact.profilePicUrl,
          pushName: contact.name,
      }
  };

  const envelope: Envelope = {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId: whatsapp.tenantId,
      type: "message.received",
      payload
  };

  await RabbitMQService.publishEvent(
      `wbot.${whatsapp.tenantId}.${whatsapp.id}.message.received`,
      envelope
  );

  return res.json({ messageId });
};
