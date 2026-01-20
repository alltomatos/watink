import { Request, Response } from "express";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import RabbitMQService from "../services/RabbitMQService";
import { Envelope, MessageReceivedPayload } from "../microservice/contracts";

const verifyAuthorizedDomain = (req: Request, chatConfig: any): boolean => {
    if (!chatConfig || !chatConfig.authorizedDomains) return true;

    const authorizedDomains = chatConfig.authorizedDomains
        .split(",")
        .map((d: string) => d.trim().toLowerCase())
        .filter((d: string) => d.length > 0);

    if (authorizedDomains.length === 0) return true; // Empty list allows all

    const origin = req.headers.origin || req.headers.referer;
    if (!origin) return false; // Block completely unknown origins if restrictions are set

    // Simple check: does origin contain one of the allowed domains?
    // Using includes to allow subdomains/protocols matching logic flexibility
    return authorizedDomains.some((domain: string) => origin.toLowerCase().includes(domain));
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp || whatsapp.type !== "webchat") {
        return res.status(404).json({ error: "Webchat not found" });
    }

    // Security: Origin Validation
    if (!verifyAuthorizedDomain(req, whatsapp.chatConfig)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized Origin" });
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

    // Security: Origin Validation
    if (!verifyAuthorizedDomain(req, whatsapp.chatConfig)) {
        return res.status(403).json({ error: "Forbidden: Unauthorized Origin" });
    }

    // Find or Create Contact
    let contact: Contact | null = null;

    if (email || phone) {
        const orConditions: any[] = [];
        if (email) orConditions.push({ email });
        if (phone) orConditions.push({ number: phone });

        if (orConditions.length > 0) {
            contact = await Contact.findOne({
                where: {
                    tenantId: whatsapp.tenantId,
                    [Op.or]: orConditions
                }
            });
        }
    }

    if (contact) {
        // Update contact info if provided
        const updateData: any = {};

        if (name && contact.name !== name) {
            updateData.name = name;
        }
        if (phone && contact.number !== phone && contact.number.includes("webchat-")) {
            updateData.number = phone;
        }
        if (email && contact.email !== email) {
            updateData.email = email;
        }

        if (Object.keys(updateData).length > 0) {
            await contact.update(updateData);
        }
    }

    if (!contact) {
        const number = phone || `webchat-${Date.now()}`;
        const contactName = name || number;
        contact = await Contact.create({
            name: contactName,
            number,
            email: email || "",
            tenantId: whatsapp.tenantId,
            isGroup: false,
            profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=25D366&color=fff`
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

    // Send initial message directly via Service to ensure persistence and socket emit
    let messageId = null;
    if (message) {
        messageId = uuidv4();
        const messageData = {
            id: messageId,
            ticketId: ticket.id,
            contactId: contact.id,
            body: message,
            fromMe: false,
            read: true,
            mediaType: "chat",
            sendType: "chat",
            status: "received",
            timestamp: Date.now(),
            createdAt: new Date(),
            tenantId: whatsapp.tenantId
        };

        await CreateMessageService({ messageData });
    }

    return res.json({ ticketId: ticket.id, contactId: contact.id, messageId });
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
