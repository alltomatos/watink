import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import KnowledgeVector from "../models/KnowledgeVector";
import KnowledgeSource from "../models/KnowledgeSource";
import { Op, QueryTypes, Sequelize } from "sequelize";
import sequelize from "../database";
import Setting from "../models/Setting";

class VectorService {
    async getEmbeddingInstance(tenantId: string): Promise<OpenAIEmbeddings> {
        const apiKeySetting = await Setting.findOne({
            where: { key: "aiApiKey", tenantId }
        });

        const apiKey = apiKeySetting?.value || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error("OpenAI API Key not found for this tenant.");
        }

        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: "text-embedding-3-small"
        });
    }

    // Split text into chunks
    async splitText(text: string): Promise<string[]> {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        return await splitter.splitText(text);
    }

    // Generate embedding for a single text
    async generateEmbedding(text: string, tenantId: string): Promise<number[]> {
        const embeddings = await this.getEmbeddingInstance(tenantId);
        return await embeddings.embedQuery(text);
    }

    // Process a source: Chunk it, embed chunks, save to DB
    async processSource(sourceId: number, tenantId: string): Promise<void> {
        const source = await KnowledgeSource.findByPk(sourceId);
        if (!source || !source.content) {
            throw new Error("Source not found or empty content");
        }

        // Update status to processing
        await source.update({ status: "processing" });

        try {
            // 1. Delete existing vectors for this source (re-indexing)
            await KnowledgeVector.destroy({ where: { sourceId, tenantId } });

            // 2. Chunk text
            const chunks = await this.splitText(source.content);

            // 3. Embed and Save matches
            // Note: For large documents, we might want to batch this.
            for (const chunk of chunks) {
                const vector = await this.generateEmbedding(chunk, tenantId);

                await KnowledgeVector.create({
                    sourceId,
                    tenantId,
                    content: chunk,
                    vector: vector,
                    // metadata could be added here
                });
            }

            await source.update({ status: "indexed" });
        } catch (error) {
            console.error("Error processing source:", error);
            await source.update({ status: "error" });
            throw error;
        }
    }

    // Search for similar vectors
    async similaritySearch(query: string, tenantId: string, limit: number = 5): Promise<KnowledgeVector[]> {
        const queryVector = await this.generateEmbedding(query, tenantId);
        const vectorString = `[${queryVector.join(",")}]`;

        // Perform cosine distance search using pgvector
        // Needs raw query for efficiency
        const results = await sequelize.query(`
      SELECT "id", "content", "sourceId", "tenantId", "createdAt", "updatedAt", 
      (vector <=> :vector) as distance
      FROM "KnowledgeVectors"
      WHERE "tenantId" = :tenantId
      ORDER BY distance ASC
      LIMIT :limit;
    `, {
            replacements: { vector: vectorString, tenantId, limit },
            type: QueryTypes.SELECT,
            model: KnowledgeVector,
            mapToModel: true
        }) as unknown as KnowledgeVector[];

        return results;
    }
}

export default new VectorService();
