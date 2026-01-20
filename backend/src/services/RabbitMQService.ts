import * as client from "amqplib";
import { Connection, Channel, ConsumeMessage } from "amqplib";
import { logger } from "../utils/logger";
import { Envelope } from "../microservice/contracts";

class RabbitMQService {
  private connection: any = null;
  private channel: Channel | null = null;
  private url: string;

  constructor() {
    this.url = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";
  }

  async connect(): Promise<void> {
    try {
      this.connection = await client.connect(this.url) as any;

      this.connection.on("error", (err: any) => {
        logger.error("RabbitMQ Connection Error", err);
        setTimeout(() => this.connect(), 5000);
      });

      this.connection.on("close", () => {
        logger.warn("RabbitMQ Connection Closed");
        setTimeout(() => this.connect(), 5000);
      });

      this.channel = await this.connection!.createChannel();
      logger.info("Connected to RabbitMQ");

      await this.setupExchanges();
    } catch (error) {
      logger.error("Failed to connect to RabbitMQ", error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async setupExchanges(): Promise<void> {
    if (!this.channel) return;

    await this.channel.assertExchange("wbot.commands", "topic", { durable: true });
    await this.channel.assertExchange("wbot.events", "topic", { durable: true });
  }

  async publishCommand(routingKey: string, message: Envelope): Promise<void> {
    if (!this.channel) {
      logger.warn("Cannot publish command, channel is closed");
      return;
    }

    logger.info(`[RabbitMQ] Publishing command to ${routingKey}`);
    this.channel.publish(
      "wbot.commands",
      routingKey,
      Buffer.from(JSON.stringify(message))
    );
  }

  async publishEvent(routingKey: string, message: Envelope): Promise<void> {
    if (!this.channel) {
      logger.warn("Cannot publish event, channel is closed");
      return;
    }

    logger.info(`[RabbitMQ] Publishing event to ${routingKey}`);
    this.channel.publish(
      "wbot.events",
      routingKey,
      Buffer.from(JSON.stringify(message))
    );
  }

  async consumeEvents(queueName: string, routingKeys: string[], handler: (msg: Envelope) => Promise<void>): Promise<void> {
    if (!this.channel) return;

    const q = await this.channel.assertQueue(queueName, { durable: true });

    for (const key of routingKeys) {
      await this.channel.bindQueue(q.queue, "wbot.events", key);
    }

    this.channel.consume(q.queue, async (msg: ConsumeMessage | null) => {
      if (msg) {
        try {
          const content: Envelope = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel?.ack(msg);
        } catch (error) {
          logger.error(`Error processing event: ${(error as Error).message}\n${(error as Error).stack}`);
          this.channel?.nack(msg, false, false);
        }
      }
    });
  }

  async consumeCommands(queueName: string, routingKeys: string[], handler: (msg: Envelope) => Promise<void>): Promise<void> {
    if (!this.channel) return;

    const q = await this.channel.assertQueue(queueName, { durable: true });

    for (const key of routingKeys) {
      await this.channel.bindQueue(q.queue, "wbot.commands", key);
    }

    this.channel.consume(q.queue, async (msg: ConsumeMessage | null) => {
      if (msg) {
        try {
          const content: Envelope = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel?.ack(msg);
        } catch (error) {
          logger.error("Error processing command", error);
          this.channel?.nack(msg, false, false);
        }
      }
    });
  }
}

export default new RabbitMQService();
