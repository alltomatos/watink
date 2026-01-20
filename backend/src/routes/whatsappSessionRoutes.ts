import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: WhatsAppSession
 *   description: Gerenciamento de Sessões WhatsApp (Engine)
 */

/**
 * @swagger
 * /whatsappsession/{whatsappId}:
 *   post:
 *     summary: Inicia uma sessão WhatsApp
 *     description: |
 *       Envia comando para o Engine (whaileys-engine) via RabbitMQ para iniciar 
 *       uma nova sessão. O Engine retornará eventos de QR Code via WebSocket.
 *       
 *       **Fluxo:**
 *       1. Backend publica `session.start` na fila `wbot.commands`
 *       2. Engine consome e inicia conexão WhatsApp
 *       3. Engine publica `session.qrcode` na fila `wbot.events`
 *       4. Backend emite QR Code via Socket.IO
 *     tags: [WhatsAppSession]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: whatsappId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da conexão WhatsApp a ser iniciada
 *     responses:
 *       200:
 *         description: Comando de início enviado ao Engine
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Session start command sent
 */
whatsappSessionRoutes.post(
  "/whatsappsession/all",
  isAuth,
  WhatsAppSessionController.restartAll
);

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.remove
);

export default whatsappSessionRoutes;

