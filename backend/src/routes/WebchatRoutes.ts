import { Router } from "express";
import cors from "cors";
import * as WebchatController from "../controllers/WebchatController";

const webchatRoutes = Router();

// CORS permissivo para o webchat - permite requisições de qualquer origem
// Necessário porque o widget será embarcado em sites de terceiros
const webchatCors = cors({
    origin: (origin, callback) => {
        // Se houver origem (browser) e quisermos permitir credenciais, devemos refletir a origem.
        // Para o widget público (sem credenciais), * funcionaria, mas com credenciais (dashboard), precisamos refletir.
        if (origin) {
            callback(null, true); // Reflete a origem (Allow-Origin: <origin>)
        } else {
            callback(null, true); // Permite server-to-server ou sem origem
        }
    },
    credentials: true, // Permite cookies/headers de auth
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
});

// Aplica CORS permissivo a todas as rotas do webchat
// Aplica CORS permissivo a todas as rotas do webchat
webchatRoutes.use("/webchat", webchatCors);

webchatRoutes.get("/webchat/:whatsappId", WebchatController.getConfig);
webchatRoutes.post("/webchat/:whatsappId/tickets", WebchatController.createTicket);
webchatRoutes.post("/webchat/:ticketId/messages", WebchatController.saveMessage);
webchatRoutes.get("/webchat/:ticketId/messages", WebchatController.listMessages);

export default webchatRoutes;
