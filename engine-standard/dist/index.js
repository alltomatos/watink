"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const rabbitmq_1 = require("./rabbitmq");
const session_1 = require("./session");
const logger_1 = require("./logger");
const http_1 = require("./http");
dotenv_1.default.config();
const AMQP_URL = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";
const start = async () => {
    logger_1.logger.info("Starting Watink Engine Standard...");
    (0, http_1.startHttpServer)();
    const rabbitmq = new rabbitmq_1.RabbitMQ(AMQP_URL);
    await rabbitmq.connect();
    const sessionManager = new session_1.SessionManager(rabbitmq);
    await rabbitmq.consumeCommands(async (msg) => {
        await sessionManager.handleCommand(msg);
    });
};
start().catch((err) => {
    logger_1.logger.error("Fatal error starting engine", err);
    process.exit(1);
});
