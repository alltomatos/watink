import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Gerenciamento de Mensagens (via Engine)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID único da mensagem
 *         body:
 *           type: string
 *           description: Conteúdo da mensagem
 *         ack:
 *           type: integer
 *           enum: [0, 1, 2, 3]
 *           description: Status de leitura (0=pendente, 1=enviado, 2=entregue, 3=lido)
 *         fromMe:
 *           type: boolean
 *           description: Se foi enviada pelo atendente
 *         mediaUrl:
 *           type: string
 *           description: URL da mídia (se houver)
 *         mediaType:
 *           type: string
 *           enum: [image, audio, video, document]
 *         ticketId:
 *           type: integer
 *         contactId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /messages/{ticketId}:
 *   get:
 *     summary: Lista mensagens de um ticket
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageNumber
 *         schema:
 *           type: integer
 *         description: Número da página para paginação
 *     responses:
 *       200:
 *         description: Lista de mensagens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 ticket:
 *                   type: object
 *                 count:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 */
messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);

/**
 * @swagger
 * /messages/{ticketId}:
 *   post:
 *     summary: Envia uma mensagem via Engine
 *     description: |
 *       Envia uma mensagem de texto ou mídia via WhatsApp.
 *       O Backend publica comando na fila `wbot.commands` e o Engine processa.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               body:
 *                 type: string
 *                 description: Texto da mensagem
 *               medias:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Arquivos de mídia (imagens, áudios, documentos)
 *     responses:
 *       200:
 *         description: Mensagem enviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  MessageController.store
);

/**
 * @swagger
 * /messages/{messageId}:
 *   delete:
 *     summary: Remove uma mensagem
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensagem removida
 */
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);

export default messageRoutes;
