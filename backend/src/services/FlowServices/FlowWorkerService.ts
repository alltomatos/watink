import { Envelope } from "../../microservice/contracts";
import RabbitMQService from "../RabbitMQService";
import { logger } from "../../utils/logger";
import FlowSession from "../../models/FlowSession";
import FlowTriggerService from "./FlowTriggerService";
import FlowExecutorService from "./FlowExecutorService";

interface FlowEventPayload {
    ticketId: number;
    contactId: number;
    messageBody: string;
    fromMe: boolean;
    isGroup: boolean;
}

class FlowWorkerService {
    public async start() {
        logger.info("Starting FlowWorkerService...");

        // Routing keys we want to consume
        const routingKeys = ["flow.execution.*"];

        // We consume from a DEDICATED queue for flow processing
        // RabbitMQService.consumeEvents usually binds to 'api.events.process'.
        // We want to consume commands/events related to flows.
        // Let's use consumeCommands but potentially with a different queue name if the lib allows, 
        // or just share the command queue but filter by routing key (less ideal for scalability but works for now).
        // Better: RabbitMQService.consumeEvents allows passing a callback.
        
        await RabbitMQService.consumeCommands("flow.worker.queue", routingKeys, async (msg: Envelope) => {
            await this.processMessage(msg);
        });
        
        logger.info("FlowWorkerService started and listening on flow.execution.*");
    }

    private async processMessage(msg: Envelope) {
        const { type, payload, tenantId } = msg;
        const data = payload as FlowEventPayload;

        logger.info(`FlowWorker processing: ${type} for ticket ${data.ticketId}`);

        try {
            if (type === "whatsapp_message") {
                await this.handleWhatsAppMessage(data, tenantId);
            }
            // Add other event types here (e.g., kanban_card_moved)
        } catch (err) {
            logger.error(`Error processing flow message ${msg.id}: ${err}`);
            // TODO: Implement DLQ or Retry logic
        }
    }

    private async handleWhatsAppMessage(data: FlowEventPayload, tenantId: number | string) {
        const { ticketId, contactId, messageBody, fromMe } = data;

        if (fromMe) return; // Ignore own messages

        // 1. Check for Active Session
        const activeSession = await FlowSession.findOne({
            where: {
                entityId: ticketId,
                entityType: "ticket",
                status: "active"
            }
        });

        if (activeSession) {
            logger.info(`[FlowWorker] Found active session ${activeSession.id} for ticket ${ticketId}`);
            await FlowExecutorService.next(activeSession.id, messageBody);
        } else {
            // 2. Check for Triggers
            const trigger = await FlowTriggerService.findTrigger(
                "whatsapp_message",
                { body: messageBody },
                tenantId
            );

            if (trigger) {
                logger.info(`[FlowWorker] Trigger matched! Starting Flow ${trigger.flowId}`);
                await FlowExecutorService.start(trigger.flowId, {
                    ticketId,
                    contactId,
                    messageBody
                });
            }
        }
    }
}

export default new FlowWorkerService();
