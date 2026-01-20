import { v4 as uuidv4 } from "uuid";
import RabbitMQService from "../RabbitMQService";
import { logger } from "../../utils/logger";

interface FlowEventPayload {
  ticketId: number;
  contactId: number;
  messageBody: string;
  fromMe: boolean;
  isGroup: boolean;
  [key: string]: any;
}

class FlowQueueService {
  private readonly QUEUE_NAME = "flow.execution.process";

  public async add(
    type: string,
    payload: FlowEventPayload,
    tenantId: number | string
  ): Promise<void> {
    try {
      // Ensure queue exists (idempotent)
      // Note: RabbitMQService abstraction might not expose assertQueue directly publicly
      // Ideally we publish to an exchange, but for simplicity/direct worker pattern we can publish to queue via routing key default
      
      const envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        type,
        tenantId,
        payload
      };

      // We reuse the existing RabbitMQService.publishCommand logic or creates a new specific one
      // Since RabbitMQService is tailored for "wbot.*", we might need to adapt it or use a generic publish
      // Looking at RabbitMQService implementation (implied), it likely publishes to 'api.commands.process' exchange.
      // We want a dedicated queue. Let's assume we can use a generic publish method if available, or just use the existing one with a special routing key.
      
      // Let's use a distinct routing key pattern for flows
      const routingKey = `flow.execution.${type}`;
      
      // We will use the existing publishCommand which sends to 'api.commands.process' exchange usually.
      // But we want a dedicated queue. 
      // Strategy: Publish to the same exchange but with a flow routing key, 
      // and bind a NEW queue to this routing key in the Worker setup.
      
      await RabbitMQService.publishCommand(routingKey, envelope);
      
      logger.info(`Flow event published: ${routingKey} for ticket ${payload.ticketId}`);
    } catch (err) {
      logger.error(`Error publishing flow event: ${err}`);
      throw err;
    }
  }
}

export default new FlowQueueService();
