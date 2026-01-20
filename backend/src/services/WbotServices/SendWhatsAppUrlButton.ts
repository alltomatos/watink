import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import formatBody from "../../helpers/Mustache";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";
import Message from "../../models/Message";
import GenerateWAMessageId from "../../helpers/GenerateWAMessageId";
import { getIO } from "../../libs/socket";

interface Request {
    body: string;
    ticket: Ticket;
    footer?: string;
    title?: string;
    url: string;
    buttonText: string;
}

const SendWhatsAppUrlButton = async ({
    body,
    ticket,
    footer,
    title,
    url,
    buttonText
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
            mediaType: "interactive",
            read: true,
            quotedMsgId: undefined,
            ack: 0,
            timestamp: new Date().getTime(),
            tenantId: ticket.tenantId,
            dataJson: JSON.stringify({
                type: "interactive",
                interactiveType: "url_button",
                url,
                buttonText
            })
        };

        const message = await Message.create(messageData);

        const io = getIO();
        io.to(message.ticketId.toString()).emit("appMessage", {
            action: "create",
            message,
            ticket: ticket,
            contact: ticket.contact
        });

        // Construct payload for message.send.interactive
        const payload = {
            sessionId,
            messageId: message.id,
            to,
            text: formattedBody,
            footer: footer || "",
            buttons: [
                {
                    type: "url",
                    text: buttonText,
                    url: url
                }
            ]
        };

        const command: Envelope = {
            id,
            timestamp: Date.now(),
            tenantId: ticket.tenantId,
            type: "message.send.interactive",
            payload
        };

        const routingKey = `wbot.${ticket.tenantId}.${sessionId}.message.send.interactive`;

        await RabbitMQService.publishCommand(routingKey, command);

        await ticket.update({ lastMessage: body });

        return message;
    } catch (err) {
        console.error(err);
        throw new AppError("ERR_SENDING_WAPP_URL_BUTTON");
    }
};

export default SendWhatsAppUrlButton;
