import express from "express";
import isAuth from "../middleware/isAuth";

import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   name: WhatsApp
 *   description: Gerenciamento de Conexões WhatsApp
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     WhatsApp:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único da conexão
 *         name:
 *           type: string
 *           description: Nome da conexão
 *         session:
 *           type: string
 *           description: ID da sessão
 *         qrcode:
 *           type: string
 *           description: QR Code em base64 (quando disponível)
 *         status:
 *           type: string
 *           enum: [DISCONNECTED, OPENING, qrcode, CONNECTED, TIMEOUT]
 *           description: Status da conexão
 *         isDefault:
 *           type: boolean
 *           description: Se é a conexão padrão
 *         retries:
 *           type: integer
 *           description: Número de tentativas de reconexão
 *         greetingMessage:
 *           type: string
 *           description: Mensagem de saudação
 *         farewellMessage:
 *           type: string
 *           description: Mensagem de despedida
 *         tenantId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /whatsapp:
 *   get:
 *     summary: Lista todas as conexões WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conexões
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WhatsApp'
 */
whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

/**
 * @swagger
 * /whatsapp:
 *   post:
 *     summary: Cria uma nova conexão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da conexão
 *               isDefault:
 *                 type: boolean
 *                 description: Define como conexão padrão
 *               greetingMessage:
 *                 type: string
 *               farewellMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conexão criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WhatsApp'
 */
whatsappRoutes.post("/whatsapp/", isAuth, WhatsAppController.store);

/**
 * @swagger
 * /whatsapp/{whatsappId}:
 *   get:
 *     summary: Busca uma conexão WhatsApp por ID
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: whatsappId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da conexão
 *     responses:
 *       200:
 *         description: Conexão encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WhatsApp'
 *       404:
 *         description: Conexão não encontrada
 */
whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);

/**
 * @swagger
 * /whatsapp/{whatsappId}:
 *   put:
 *     summary: Atualiza uma conexão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: whatsappId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               greetingMessage:
 *                 type: string
 *               farewellMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conexão atualizada com sucesso
 */
whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);

/**
 * @swagger
 * /whatsapp/{whatsappId}:
 *   delete:
 *     summary: Remove uma conexão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: whatsappId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conexão removida com sucesso
 */
whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  WhatsAppController.remove
);

export default whatsappRoutes;
