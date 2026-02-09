import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";
import Message from "../../models/Message";
import { getIO } from "../../libs/socket";
import GenerateWAMessageId from "../../helpers/GenerateWAMessageId";

interface CarouselCard {
    headerUrl?: string; // Optional image
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
    buttons: Array<{
        type: "url" | "reply" | "call";
        text: string;
        url?: string;
        phoneNumber?: string;
        buttonId?: string;
    }>;
}

interface Request {
    ticket: Ticket;
    body: string; // Internal message body/representation
    cards: CarouselCard[];
}

const SendWhatsAppCarousel = async ({
    ticket,
    body,
    cards
}: Request): Promise<Message> => {
    try {
        if (!ticket.whatsappId) {
            throw new AppError("ERR_TICKET_WRONG_WHATSAPP_ID");
        }

        const contactNumber = ticket.contact.number.replace(/\D/g, "");

        // Create message in DB as a placeholder/log
        const messageData = {
            id: GenerateWAMessageId(),
            ticketId: ticket.id,
            contactId: undefined,
            body: body,
            fromMe: true,
            mediaType: "carousel", // or "template" / "interactive" depending on how frontend renders it, but "carousel" is specific
            read: true,
            quotedMsgId: null,
            ack: 0,
            timestamp: new Date().getTime(),
            tenantId: ticket.tenantId,
            dataJson: JSON.stringify({ cards })
        };

        const message = await Message.create(messageData);

        const io = getIO();
        io.to(message.ticketId.toString()).emit("appMessage", {
            action: "create",
            message,
            ticket: ticket,
            contact: ticket.contact
        });

        // Contruct Envelope for message.send.carousel
        // Based on contracts.ts SendCarouselPayload
        const command: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId: ticket.tenantId,
            type: "message.send.carousel",
            payload: {
                sessionId: ticket.whatsappId,
                messageId: message.id,
                to: `${contactNumber}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                text: "Verifique as opções abaixo:", // Main message text required by some flows or fallback
                cards: cards.map(c => ({
                    header: {
                        title: c.title,
                        subtitle: c.subtitle || "",
                        imageUrl: c.headerUrl || ""
                    },
                    body: c.body,
                    footer: c.footer || "",
                    buttons: c.buttons.map(b => ({
                        type: b.type,
                        displayText: b.text,
                        url: b.url,
                        id: b.buttonId
                    }))
                }))
            }
        };

        // Determine Engine Type
        let engineType = ticket.whatsapp?.engineType;
        if (!engineType) {
            const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
            engineType = whatsapp?.engineType;
        }
        if (!engineType) engineType = "whaileys";

        await RabbitMQService.publishCommand(
            `wbot.${ticket.tenantId}.${ticket.whatsappId}.${engineType}.message.send.carousel`,
            command
        );

        await ticket.update({ lastMessage: body });

        return message;
    } catch (err) {
        console.error(err);
        throw new AppError("ERR_SENDING_WAPP_MSG");
    }
};

export default SendWhatsAppCarousel;
