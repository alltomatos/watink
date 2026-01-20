import * as client from "amqplib";
import { Connection, Channel, ConsumeMessage } from "amqplib";
import { Envelope } from "./contracts";
import { logger } from "./logger";

export class RabbitMQ {
  private connection: any = null;
  private channel: Channel | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  private handler: ((msg: Envelope) => Promise<void>) | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await client.connect(this.url) as any;
      this.channel = await this.connection!.createChannel();
      logger.info("Connected to RabbitMQ");

      await this.setupExchanges();
      if (this.handler) {
        await this.setupConsumer();
      }
    } catch (error) {
      logger.error("Failed to connect to RabbitMQ", error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async setupExchanges(): Promise<void> {
    if (!this.channel) return;

    // Command Exchange (Backend -> Engine)
    await this.channel.assertExchange("wbot.commands", "topic", { durable: true });

    // Event Exchange (Engine -> Backend)
    await this.channel.assertExchange("wbot.events", "topic", { durable: true });
  }

  async publishEvent(routingKey: string, message: Envelope): Promise<void> {
    if (!this.channel) {
      logger.warn("Cannot publish event, channel is closed");
      return;
    }

    logger.info(`[RabbitMQ] Publishing event to ${routingKey}: ${message.type}`);

    this.channel.publish(
      "wbot.events",
      routingKey,
      Buffer.from(JSON.stringify(message))
    );
  }

  async consumeCommands(handler: (msg: Envelope) => Promise<void>): Promise<void> {
    this.handler = handler;
    if (this.channel) {
      await this.setupConsumer();
    }
  }

  private async setupConsumer(): Promise<void> {
    if (!this.channel || !this.handler) return;

    // Create a durable queue for this engine instance to prevent message loss during startup
    const q = await this.channel.assertQueue("wbot_engine_commands", { durable: true });

    await this.channel.bindQueue(q.queue, "wbot.commands", "command.general");
    // Bind all session and message commands using wildcard
    // Pattern: wbot.<tenantId>.<sessionId>.<commandType>
    await this.channel.bindQueue(q.queue, "wbot.commands", "wbot.*.*.#");

    this.channel.consume(q.queue, async (msg: ConsumeMessage | null) => {
      if (msg) {
        try {
          logger.info(`[RabbitMQ] Engine Received command on ${msg.fields.routingKey}`);
          const content: Envelope = JSON.parse(msg.content.toString());
          if (this.handler) {
            logger.info(`[RabbitMQ] Invoking handler for ${content.type}`);
            await this.handler(content);
            logger.info(`[RabbitMQ] Handler finished for ${content.type}`);
          }
          this.channel?.ack(msg);
        } catch (error) {
          logger.error("Error processing message", error);
          this.channel?.nack(msg, false, false);
        }
      }
    });

    logger.info("Consumer setup completed, listening for commands.");
  }
}
