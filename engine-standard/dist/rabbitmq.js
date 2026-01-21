"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQ = void 0;
const client = __importStar(require("amqplib"));
const logger_1 = require("./logger");
class RabbitMQ {
    constructor(url) {
        this.connection = null;
        this.channel = null;
        this.handler = null;
        this.url = url;
    }
    async connect() {
        try {
            this.connection = await client.connect(this.url);
            this.channel = await this.connection.createChannel();
            logger_1.logger.info("Connected to RabbitMQ");
            await this.setupExchanges();
            if (this.handler) {
                await this.setupConsumer();
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to connect to RabbitMQ", error);
            setTimeout(() => this.connect(), 5000);
        }
    }
    async setupExchanges() {
        if (!this.channel)
            return;
        // Command Exchange (Backend -> Engine)
        await this.channel.assertExchange("wbot.commands", "topic", { durable: true });
        // Event Exchange (Engine -> Backend)
        await this.channel.assertExchange("wbot.events", "topic", { durable: true });
    }
    async publishEvent(routingKey, message) {
        if (!this.channel) {
            logger_1.logger.warn("Cannot publish event, channel is closed");
            return;
        }
        logger_1.logger.info(`[RabbitMQ] Publishing event to ${routingKey}: ${message.type}`);
        this.channel.publish("wbot.events", routingKey, Buffer.from(JSON.stringify(message)));
    }
    async consumeCommands(handler) {
        this.handler = handler;
        if (this.channel) {
            await this.setupConsumer();
        }
    }
    async setupConsumer() {
        if (!this.channel || !this.handler)
            return;
        // Create a temporary queue for this engine instance
        const q = await this.channel.assertQueue("", { exclusive: true });
        await this.channel.bindQueue(q.queue, "wbot.commands", "command.general");
        // Bind all session and message commands using wildcard
        // Pattern: wbot.<tenantId>.<sessionId>.<commandType>
        await this.channel.bindQueue(q.queue, "wbot.commands", "wbot.*.*.#");
        this.channel.consume(q.queue, async (msg) => {
            if (msg) {
                try {
                    logger_1.logger.info(`[RabbitMQ] Engine Received command on ${msg.fields.routingKey}`);
                    const content = JSON.parse(msg.content.toString());
                    if (this.handler) {
                        await this.handler(content);
                    }
                    this.channel?.ack(msg);
                }
                catch (error) {
                    logger_1.logger.error("Error processing message", error);
                    this.channel?.nack(msg, false, false);
                }
            }
        });
        logger_1.logger.info("Consumer setup completed, listening for commands.");
    }
}
exports.RabbitMQ = RabbitMQ;
