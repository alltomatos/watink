import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import formatBody from "../../helpers/Mustache";
import RabbitMQService from "../RabbitMQService";
import { Envelope, SendButtonsPayload, SendListPayload } from "../../microservice/contracts";
import Message from "../../models/Message";
import GenerateWAMessageId from "../../helpers/GenerateWAMessageId";

interface Request {
    body: string;
    ticket: Ticket;
    buttons?: Array<{ label: string; id: string }>;
    list?: {
        title: string;
        description?: string;
        buttonText: string;
        sections: Array<{
            title: string;
            rows: Array<{
                id: string;
                title: string;
                description?: string;
            }>;
        }>;
    };
}

const SendWhatsAppInteractive = async ({
    body,
    ticket,
    buttons,
    list
}: Request): Promise<Message> => {
    try {
        const formattedBody = formatBody(body, ticket.contact);
        const id = uuidv4();
        const sessionId = ticket.whatsappId;
        const contactNumber = ticket.contact.number.replace(/\D/g, "");
        const to = `${contactNumber}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

        const messageData = {
            id: GenerateWAMessageId(),
            ticketId: ticket.id,
            contactId: undefined,
            body: formattedBody,
            fromMe: true,
            mediaType: "chat",
            read: true,
            quotedMsgId: undefined,
            ack: 0,
            timestamp: new Date().getTime()
        };

        const message = await Message.create(messageData);

        // Determine Engine Type
        let engineType = ticket.whatsapp?.engineType;
        if (!engineType) {
            const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
            engineType = whatsapp?.engineType;
        }
        if (!engineType) engineType = "whaileys";

        let command: Envelope;
        let routingKey = "";

        if (buttons && buttons.length > 0) {
            const payload: SendButtonsPayload = {
                sessionId,
                messageId: message.id,
                to,
                text: formattedBody,
                buttons: buttons.map(b => ({
                    buttonId: b.id,
                    buttonText: b.label
                }))
            };

            command = {
                id,
                timestamp: Date.now(),
                tenantId: ticket.tenantId,
                type: "message.send.buttons",
                payload
            };

            routingKey = `wbot.${ticket.tenantId}.${sessionId}.${engineType}.message.send.buttons`;
        } else if (list) {
            const payload: SendListPayload = {
                sessionId,
                messageId: message.id,
                to,
                text: formattedBody,
                buttonText: list.buttonText || "Opções",
                sections: list.sections.map(s => ({
                    title: s.title,
                    rows: s.rows.map(r => ({
                        rowId: r.id,
                        title: r.title,
                        description: r.description
                    }))
                }))
            };

            command = {
                id,
                timestamp: Date.now(),
                tenantId: ticket.tenantId,
                type: "message.send.list",
                payload
            };

            routingKey = `wbot.${ticket.tenantId}.${sessionId}.${engineType}.message.send.list`;
        } else {
            throw new Error("Invalid interactive message: must have buttons or list");
        }

        await RabbitMQService.publishCommand(routingKey, command);

        await ticket.update({ lastMessage: body });

        return message;
    } catch (err) {
        throw new AppError("ERR_SENDING_WAPP_INTERACTIVE");
    }
};

export default SendWhatsAppInteractive;
