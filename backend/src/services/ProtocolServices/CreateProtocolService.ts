import Protocol from "../../models/Protocol";
import ProtocolHistory from "../../models/ProtocolHistory";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import { format, addHours } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import RabbitMQService from "../RabbitMQService";
import { Envelope } from "../../microservice/contracts";
import GenerateWAMessageId from "../../helpers/GenerateWAMessageId";
import { getIO } from "../../libs/socket";

interface CreateProtocolData {
    tenantId: string | number;
    ticketId?: number;
    contactId?: number;
    userId?: number;
    subject: string;
    description?: string;
    priority?: string;
    category?: string;
    dueDate?: Date;
    carouselCards?: any[]; // Array of cards
}

const generateProtocolNumber = (): string => {
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${date}-${random}`;
};

import SendWhatsAppCarousel from "../WbotServices/SendWhatsAppCarousel";
import SendWhatsAppUrlButton from "../WbotServices/SendWhatsAppUrlButton";

const CreateProtocolService = async (
    data: CreateProtocolData,
    createdByUserId?: number
): Promise<Protocol> => {
    const protocolNumber = generateProtocolNumber();

    let dueDate = data.dueDate;

    // SLA Logic
    try {
        const enabledSetting = await Setting.findOne({ where: { key: "helpdesk_settings_enabled", tenantId: data.tenantId } });
        if (enabledSetting && enabledSetting.value === "true") {
            const slaSetting = await Setting.findOne({ where: { key: "helpdesk_sla_config", tenantId: data.tenantId } });
            if (slaSetting) {
                const slaConfig = JSON.parse(slaSetting.value);
                const priority = data.priority || "medium";
                const hours = slaConfig[priority];
                if (hours) {
                    dueDate = addHours(new Date(), parseInt(hours));
                }
            }
        }
    } catch (err) {
        console.error("Error calculating SLA due date", err);
    }

    const protocol = await Protocol.create({
        ...data,
        dueDate,
        protocolNumber,
        status: "open"
    });

    // Create history entry
    await ProtocolHistory.create({
        protocolId: protocol.id,
        userId: createdByUserId,
        action: "created",
        newValue: "open",
        comment: `Protocolo ${protocolNumber} criado`
    });

    const fullProtocol = await Protocol.findByPk(protocol.id, {
        include: [
            { model: Contact, as: "contact" },
            { model: User, as: "user" },
            { 
                model: Ticket, 
                as: "ticket",
                include: [
                    { model: Whatsapp, as: "whatsapp" }
                ]
            },
            { model: ProtocolHistory, as: "history", include: [{ model: User, as: "user" }] }
        ]
    });

    // Emit socket event for real-time Kanban updates
    try {
        const { getIO } = await import("../../libs/socket");
        const io = getIO();
        io.to("helpdesk-kanban").emit("protocol", {
            action: "create",
            protocol: fullProtocol
        });
    } catch (err) {
        console.error("Error emitting protocol socket event:", err);
    }

    // Send automatic message if ticketId is present
    if (data.ticketId) {
        try {
            // TODO: Restore Carousel logic if needed. Currently using reliable RabbitMQ interactive message.
            // if (data.carouselCards && data.carouselCards.length > 0) { ... }

            if (fullProtocol?.ticket && fullProtocol.ticket.whatsappId) {
                const { contact, ticket } = fullProtocol;
                const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                const protocolUrl = `${appUrl}/public/protocols/${protocol.token}`; // Use token URL from HEAD idea, it's better for public access

                const priorityMap: Record<string, string> = {
                    low: "Baixa",
                    medium: "Normal",
                    high: "Alta",
                    urgent: "Urgente"
                };

                const payload = {
                    sessionId: ticket.whatsappId,
                    to: `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                    text: `*Olá! Seu protocolo de atendimento foi criado com sucesso.*\n\n*Protocolo:* #${protocol.protocolNumber}\n*Assunto:* ${protocol.subject}\n*Prioridade:* ${priorityMap[protocol.priority] || protocol.priority}\n`,
                };

                // Fallback para Texto Simples para garantir entrega (Botões instáveis na API não-oficial)
                // protocolUrl já existe no escopo
                const textMessage = `${payload.text}\n🔗 Acompanhe seu protocolo clicando aqui:\n${protocolUrl}`;

                const command: Envelope = {
                    id: uuidv4(),
                    timestamp: Date.now(),
                    tenantId: data.tenantId,
                    type: "message.send.text",
                    payload: {
                        sessionId: ticket.whatsappId,
                        to: payload.to,
                        body: textMessage, // Engine espera 'body' (vide contracts.ts e session.ts)
                        ticketId: ticket.id
                    }
                };

                const engineType = ticket.whatsapp?.engineType || "whaileys";

                await RabbitMQService.publishCommand(
                    `wbot.${data.tenantId}.${ticket.whatsappId}.${engineType}.message.send.text`,
                    command
                );
            }
        } catch (err) {
            console.error("Erro ao enviar mensagem de confirmação de protocolo:", err);
        }
    }

    return fullProtocol!;
};

export default CreateProtocolService;
