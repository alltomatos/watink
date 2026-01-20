import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Ensure pgvector extension is enabled
        await queryInterface.sequelize.query("CREATE EXTENSION IF NOT EXISTS vector;");

        // Table: ConversationEmbeddings
        await queryInterface.createTable("ConversationEmbeddings", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            ticketId: {
                type: DataTypes.INTEGER,
                references: { model: "Tickets", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            contactId: {
                type: DataTypes.INTEGER,
                references: { model: "Contacts", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            summary: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "AI-generated summary of the conversation"
            },
            topics: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: "Array of identified topics/tags"
            },
            sentiment: {
                type: DataTypes.FLOAT,
                allowNull: true,
                comment: "Sentiment score from -1 (negative) to 1 (positive)"
            },
            messageCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            embedding: {
                type: DataTypes.ARRAY(DataTypes.FLOAT),
                allowNull: true,
                comment: "Vector embedding (1536 dimensions for OpenAI ada-002)"
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: "Additional metadata (duration, agent, etc)"
            },
            processedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            tenantId: {
                type: DataTypes.UUID,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Convert embedding column to proper vector type
        try {
            await queryInterface.sequelize.query(
                `ALTER TABLE "ConversationEmbeddings" ALTER COLUMN embedding TYPE vector(1536);`
            );
        } catch (e) {
            console.log("Vector type conversion issue (may already be vector type):", e);
        }

        // Create indexes for efficient querying
        await queryInterface.addIndex("ConversationEmbeddings", ["ticketId"], {
            name: "conversation_embeddings_ticket_idx"
        });
        await queryInterface.addIndex("ConversationEmbeddings", ["contactId"], {
            name: "conversation_embeddings_contact_idx"
        });
        await queryInterface.addIndex("ConversationEmbeddings", ["tenantId"], {
            name: "conversation_embeddings_tenant_idx"
        });
        await queryInterface.addIndex("ConversationEmbeddings", ["processedAt"], {
            name: "conversation_embeddings_processed_idx"
        });

        // Create IVFFlat index for fast vector similarity search (after data is populated)
        // Note: This requires data in the table; in practice you might run this separately
        try {
            await queryInterface.sequelize.query(`
                CREATE INDEX IF NOT EXISTS conversation_embeddings_vector_idx 
                ON "ConversationEmbeddings" 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            `);
        } catch (e) {
            console.log("Vector index creation issue (may need data first):", e);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("ConversationEmbeddings");
    }
};
