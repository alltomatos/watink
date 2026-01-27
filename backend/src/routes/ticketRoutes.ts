import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

// ... (Swagger docs omitted for brevity)

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put("/tickets/close-all", isAuth, TicketController.closeAll);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.delete(
    "/tickets/:ticketId",
    isAuth,
    checkPermission("tickets:delete"),
    TicketController.remove
);

// Novo: Rota para buscar histórico de mensagens sob demanda
ticketRoutes.post("/tickets/:ticketId/history", isAuth, TicketController.syncHistory);
ticketRoutes.get("/tickets/:ticketId/participants", isAuth, TicketController.showParticipants);

export default ticketRoutes;
