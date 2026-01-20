import { Request, Response } from "express";
import EmbeddingService from "../services/AIServices/EmbeddingService";
import Setting from "../models/Setting";
import { logger } from "../utils/logger";

class AIController {
    /**
     * Semantic search across conversation history
     * POST /ai/search
     */
    async search(req: Request, res: Response): Promise<Response> {
        const { tenantId } = req.user!;
        const { query, limit = 5, contactId } = req.body;

        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        // Check if AI is enabled
        const aiEnabled = await Setting.findOne({
            where: { key: "aiEnabled", tenantId }
        });

        if (aiEnabled?.value !== "true") {
            return res.status(403).json({ error: "AI is not enabled for this tenant" });
        }

        try {
            const results = await EmbeddingService.searchSimilar(
                query,
                tenantId,
                limit,
                contactId
            );

            return res.json({ results });
        } catch (error) {
            logger.error("AI Search error", error);
            return res.status(500).json({ error: "Failed to perform search" });
        }
    }

    /**
     * Get AI insights for a specific contact
     * GET /ai/contact/:id/insights
     */
    async getContactInsights(req: Request, res: Response): Promise<Response> {
        const { tenantId } = req.user!;
        const { id } = req.params;

        // Check if AI Assistant is enabled
        const [aiEnabled, aiAssistantEnabled] = await Promise.all([
            Setting.findOne({ where: { key: "aiEnabled", tenantId } }),
            Setting.findOne({ where: { key: "aiAssistantEnabled", tenantId } })
        ]);

        if (aiEnabled?.value !== "true" || aiAssistantEnabled?.value !== "true") {
            return res.status(403).json({ error: "AI Assistant is not enabled" });
        }

        try {
            const insights = await EmbeddingService.getContactInsights(
                parseInt(id, 10),
                tenantId
            );

            if (!insights) {
                return res.json({
                    message: "No conversation history available for analysis",
                    insights: null
                });
            }

            return res.json({ insights });
        } catch (error) {
            logger.error("Get contact insights error", error);
            return res.status(500).json({ error: "Failed to get insights" });
        }
    }

    /**
     * Manually trigger processing for a ticket
     * POST /ai/process/ticket/:id
     */
    async processTicket(req: Request, res: Response): Promise<Response> {
        const { tenantId } = req.user!;
        const { id } = req.params;

        // Check if AI is enabled
        const aiEnabled = await Setting.findOne({
            where: { key: "aiEnabled", tenantId }
        });

        if (aiEnabled?.value !== "true") {
            return res.status(403).json({ error: "AI is not enabled for this tenant" });
        }

        try {
            const embedding = await EmbeddingService.processTicket(
                parseInt(id, 10),
                tenantId
            );

            if (!embedding) {
                return res.status(400).json({
                    error: "Could not process ticket - it may be a group or have no messages"
                });
            }

            return res.json({
                message: "Ticket processed successfully",
                embedding: {
                    id: embedding.id,
                    summary: embedding.summary,
                    topics: embedding.topics,
                    sentiment: embedding.sentiment
                }
            });
        } catch (error) {
            logger.error("Process ticket error", error);
            return res.status(500).json({ error: "Failed to process ticket" });
        }
    }

    /**
     * Ask AI a question about conversation history (RAG)
     * POST /ai/ask
     */
    async ask(req: Request, res: Response): Promise<Response> {
        const { tenantId } = req.user!;
        const { question, contactId } = req.body;

        if (!question) {
            return res.status(400).json({ error: "Question is required" });
        }

        // Check if AI Assistant is enabled
        const [aiEnabled, aiAssistantEnabled] = await Promise.all([
            Setting.findOne({ where: { key: "aiEnabled", tenantId } }),
            Setting.findOne({ where: { key: "aiAssistantEnabled", tenantId } })
        ]);

        if (aiEnabled?.value !== "true" || aiAssistantEnabled?.value !== "true") {
            return res.status(403).json({ error: "AI Assistant is not enabled" });
        }

        try {
            // Get relevant conversations
            const relevantConversations = await EmbeddingService.searchSimilar(
                question,
                tenantId,
                3,
                contactId
            );

            // Build context from relevant conversations
            const context = relevantConversations
                .map(c => `Conversa (Ticket #${c.ticketId}): ${c.summary}`)
                .join("\n\n");

            // Call AI for answer
            const config = await EmbeddingService.getConfig(tenantId);
            const { OpenAI } = await import("openai");

            const client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.provider === "grok" ? "https://api.x.ai/v1" : undefined
            });

            const response = await client.chat.completions.create({
                model: config.model,
                messages: [
                    {
                        role: "system",
                        content: `Você é um assistente de IA que responde perguntas sobre o histórico de conversas.
Use APENAS o contexto fornecido para responder. Se não encontrar informação relevante, diga claramente.

Contexto das conversas anteriores:
${context || "Nenhum histórico disponível."}`
                    },
                    { role: "user", content: question }
                ],
                temperature: 0.5
            });

            const answer = response.choices[0].message.content || "Não foi possível gerar resposta.";

            return res.json({
                answer,
                sources: relevantConversations.map(c => ({
                    ticketId: c.ticketId,
                    summary: c.summary
                }))
            });
        } catch (error) {
            logger.error("AI Ask error", error);
            return res.status(500).json({ error: "Failed to process question" });
        }
    }
}

export default new AIController();
