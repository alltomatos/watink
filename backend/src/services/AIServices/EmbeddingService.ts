import { OpenAI } from "openai";
import Setting from "../../models/Setting";
import ConversationEmbedding from "../../models/ConversationEmbedding";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import sequelize from "../../database";
import { QueryTypes } from "sequelize";

interface AnalysisResult {
    summary: string;
    topics: string[];
    sentiment: number;
}

interface EmbeddingConfig {
    apiKey: string;
    provider: string;
    model: string;
}

class EmbeddingService {
    /**
     * Get OpenAI/Grok configuration from Settings
     */
    async getConfig(tenantId: string | number): Promise<EmbeddingConfig> {
        const [apiKeySetting, providerSetting, modelSetting] = await Promise.all([
            Setting.findOne({ where: { key: "aiApiKey", tenantId } }),
            Setting.findOne({ where: { key: "aiProvider", tenantId } }),
            Setting.findOne({ where: { key: "aiModel", tenantId } })
        ]);

        const apiKey = apiKeySetting?.value || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("AI API Key not configured for tenant");
        }

        return {
            apiKey,
            provider: providerSetting?.value || "openai",
            model: modelSetting?.value || "gpt-4o-mini"
        };
    }

    /**
     * Generate embedding vector for text
     */
    async generateEmbedding(text: string, tenantId: string | number): Promise<number[]> {
        const config = await this.getConfig(tenantId);

        const client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.provider === "grok" ? "https://api.x.ai/v1" : undefined
        });

        const response = await client.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            dimensions: 1536
        });

        return response.data[0].embedding;
    }

    /**
     * Analyze conversation and generate summary, topics and sentiment
     */
    async analyzeConversation(messages: Message[], tenantId: string | number): Promise<AnalysisResult> {
        const config = await this.getConfig(tenantId);

        const client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.provider === "grok" ? "https://api.x.ai/v1" : undefined
        });

        // Format messages for analysis
        const conversationText = messages
            .map(m => `${m.fromMe ? "Atendente" : "Cliente"}: ${m.body}`)
            .join("\n");

        const prompt = `Analise a conversa abaixo e retorne um JSON com:
- summary: resumo conciso da conversa (máximo 200 palavras)
- topics: array com até 5 tópicos/tags principais
- sentiment: número de -1 (muito negativo) a 1 (muito positivo)

Conversa:
${conversationText}

Retorne APENAS o JSON, sem markdown:`;

        const response = await client.chat.completions.create({
            model: config.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: config.provider === "openai" ? { type: "json_object" } : undefined
        });

        const content = response.choices[0].message.content || "{}";

        try {
            // Clean potential markdown
            const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            logger.error("Error parsing AI analysis response", { content, error: e });
            return {
                summary: "Análise não disponível",
                topics: [],
                sentiment: 0
            };
        }
    }

    /**
     * Process a closed ticket - generate embeddings and analysis
     * Only processes individual chats (not groups)
     */
    async processTicket(ticketId: number, tenantId: string | number): Promise<ConversationEmbedding | null> {
        const ticket = await Ticket.findByPk(ticketId, {
            include: [{ model: Contact }]
        });

        if (!ticket) {
            logger.warn(`Ticket ${ticketId} not found for embedding processing`);
            return null;
        }

        // RULE: Skip group conversations
        if (ticket.isGroup) {
            logger.info(`Skipping group ticket ${ticketId} for embedding processing`);
            return null;
        }

        // Get all messages for this ticket
        const messages = await Message.findAll({
            where: { ticketId },
            order: [["createdAt", "ASC"]]
        });

        if (messages.length === 0) {
            logger.info(`Ticket ${ticketId} has no messages, skipping`);
            return null;
        }

        // Check if already processed
        const existing = await ConversationEmbedding.findOne({
            where: { ticketId, tenantId }
        });

        if (existing) {
            logger.info(`Ticket ${ticketId} already has embedding, updating...`);
        }

        try {
            // Analyze conversation
            const analysis = await this.analyzeConversation(messages, tenantId);

            // Generate embedding from summary
            const embedding = await this.generateEmbedding(
                `${analysis.summary} Tópicos: ${analysis.topics.join(", ")}`,
                tenantId
            );

            // Calculate metadata
            const metadata = {
                firstMessageAt: messages[0].createdAt,
                lastMessageAt: messages[messages.length - 1].createdAt,
                agentMessages: messages.filter(m => m.fromMe).length,
                customerMessages: messages.filter(m => !m.fromMe).length
            };

            // Create or update embedding
            if (existing) {
                await existing.update({
                    summary: analysis.summary,
                    topics: analysis.topics,
                    sentiment: analysis.sentiment,
                    messageCount: messages.length,
                    embedding,
                    metadata,
                    processedAt: new Date()
                });
                return existing;
            } else {
                return await ConversationEmbedding.create({
                    ticketId,
                    contactId: ticket.contactId,
                    tenantId,
                    summary: analysis.summary,
                    topics: analysis.topics,
                    sentiment: analysis.sentiment,
                    messageCount: messages.length,
                    embedding,
                    metadata,
                    processedAt: new Date()
                });
            }
        } catch (error) {
            logger.error(`Error processing ticket ${ticketId} for embeddings`, error);
            throw error;
        }
    }

    /**
     * Semantic search across conversation embeddings
     */
    async searchSimilar(
        query: string,
        tenantId: string | number,
        limit: number = 5,
        contactId?: number
    ): Promise<ConversationEmbedding[]> {
        const queryVector = await this.generateEmbedding(query, tenantId);
        const vectorString = `[${queryVector.join(",")}]`;

        let whereClause = `"tenantId" = :tenantId`;
        const replacements: Record<string, any> = { vector: vectorString, tenantId, limit };

        if (contactId) {
            whereClause += ` AND "contactId" = :contactId`;
            replacements.contactId = contactId;
        }

        const results = await sequelize.query(`
            SELECT "id", "ticketId", "contactId", "summary", "topics", "sentiment", 
                   "messageCount", "metadata", "processedAt", "tenantId",
                   (embedding <=> :vector) as distance
            FROM "ConversationEmbeddings"
            WHERE ${whereClause}
            ORDER BY distance ASC
            LIMIT :limit;
        `, {
            replacements,
            type: QueryTypes.SELECT,
            model: ConversationEmbedding,
            mapToModel: true
        }) as unknown as ConversationEmbedding[];

        return results;
    }

    /**
     * Get insights for a specific contact
     */
    async getContactInsights(contactId: number, tenantId: string | number) {
        const embeddings = await ConversationEmbedding.findAll({
            where: { contactId, tenantId },
            order: [["processedAt", "DESC"]],
            limit: 10
        });

        if (embeddings.length === 0) {
            return null;
        }

        // Calculate aggregated insights
        const totalMessages = embeddings.reduce((sum, e) => sum + e.messageCount, 0);
        const avgSentiment = embeddings.reduce((sum, e) => sum + (e.sentiment || 0), 0) / embeddings.length;

        // Gather all topics
        const allTopics: Record<string, number> = {};
        embeddings.forEach(e => {
            (e.topics || []).forEach((topic: string) => {
                allTopics[topic] = (allTopics[topic] || 0) + 1;
            });
        });

        // Sort topics by frequency
        const topTopics = Object.entries(allTopics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic]) => topic);

        return {
            conversationCount: embeddings.length,
            totalMessages,
            averageSentiment: Math.round(avgSentiment * 100) / 100,
            topTopics,
            recentSummaries: embeddings.slice(0, 3).map(e => ({
                ticketId: e.ticketId,
                summary: e.summary,
                sentiment: e.sentiment,
                processedAt: e.processedAt
            }))
        };
    }
}

export default new EmbeddingService();
