import { Router } from "express";
import * as WebchatController from "../controllers/WebchatController";

const webchatRoutes = Router();

webchatRoutes.get("/webchat/:whatsappId", WebchatController.getConfig);
webchatRoutes.post("/webchat/:whatsappId/tickets", WebchatController.createTicket);
webchatRoutes.post("/webchat/:ticketId/messages", WebchatController.saveMessage);
webchatRoutes.get("/webchat/:ticketId/messages", WebchatController.listMessages);

export default webchatRoutes;
