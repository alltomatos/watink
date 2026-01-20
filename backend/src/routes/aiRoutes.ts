import { Router } from "express";
import isAuth from "../middleware/isAuth";
import AIController from "../controllers/AIController";

const aiRoutes = Router();

// Semantic search across conversations
aiRoutes.post("/ai/search", isAuth, AIController.search);

// Ask AI a question (RAG)
aiRoutes.post("/ai/ask", isAuth, AIController.ask);

// Get AI insights for a contact
aiRoutes.get("/ai/contact/:id/insights", isAuth, AIController.getContactInsights);

// Manually process a ticket for embeddings
aiRoutes.post("/ai/process/ticket/:id", isAuth, AIController.processTicket);

export default aiRoutes;
