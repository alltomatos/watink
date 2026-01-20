import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as MicroserviceController from "../controllers/MicroserviceController";

const microserviceRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Engine Standard
 *   description: WhatsApp Engine (Whaileys) interactive messaging and session management.
 */

/**
 * @swagger
 * /microservice/sendButtons:
 *   post:
 *     summary: Send interactive buttons
 *     tags: [Engine Standard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketId:
 *                 type: integer
 *               text:
 *                 type: string
 *               footer:
 *                 type: string
 *               buttons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     buttonId:
 *                       type: string
 *                     buttonText:
 *                       type: string
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Command sent to queue
 */
microserviceRoutes.post("/microservice/sendButtons", isAuth, MicroserviceController.sendButtons);

/**
 * @swagger
 * /microservice/sendList:
 *   post:
 *     summary: Send interactive list
 *     tags: [Engine Standard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketId:
 *                 type: integer
 *               text:
 *                 type: string
 *               footer:
 *                 type: string
 *               buttonText:
 *                 type: string
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     rows:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rowId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *     responses:
 *       200:
 *         description: Command sent to queue
 */
microserviceRoutes.post("/microservice/sendList", isAuth, MicroserviceController.sendList);

/**
 * @swagger
 * /microservice/sendPoll:
 *   post:
 *     summary: Send interactive poll
 *     tags: [Engine Standard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketId:
 *                 type: integer
 *               name:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               selectableCount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Command sent to queue
 */
microserviceRoutes.post("/microservice/sendPoll", isAuth, MicroserviceController.sendPoll);

/**
 * @swagger
 * /microservice/sendCarousel:
 *   post:
 *     summary: Send interactive carousel
 *     tags: [Engine Standard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketId:
 *                 type: integer
 *               text:
 *                 type: string
 *               footer:
 *                 type: string
 *               cards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     headerUrl:
 *                       type: string
 *                     title:
 *                       type: string
 *                     body:
 *                       type: string
 *                     footer:
 *                       type: string
 *                     buttons:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [url, reply]
 *                           text:
 *                             type: string
 *                           url:
 *                             type: string
 *                           buttonId:
 *                             type: string
 *     responses:
 *       200:
 *         description: Command sent to queue
 */
microserviceRoutes.post("/microservice/sendCarousel", isAuth, MicroserviceController.sendCarousel);

export default microserviceRoutes;
