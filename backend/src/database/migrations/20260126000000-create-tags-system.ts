import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Criar tabela TagGroups
        await queryInterface.createTable("TagGroups", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            description: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            order: {
                type: DataTypes.INTEGER,
                defaultValue: 0
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

        // 2. Criar tabela Tags
        await queryInterface.createTable("Tags", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "Tenants", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            groupId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "TagGroups", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            color: {
                type: DataTypes.STRING(20),
                defaultValue: "blue"
            },
            icon: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            description: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            archived: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            usageCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            createdBy: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
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

        // Índice unique para nome da tag por tenant
        await queryInterface.addIndex("Tags", ["tenantId", "name"], {
            unique: true,
            name: "tags_tenant_name_unique"
        });

        // 3. Criar tabela EntityTags (polimórfica)
        await queryInterface.createTable("EntityTags", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            tagId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Tags", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            entityType: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            entityId: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            createdBy: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Índices para performance de busca
        await queryInterface.addIndex("EntityTags", ["entityType", "entityId"], {
            name: "entity_tags_entity_lookup"
        });

        await queryInterface.addIndex("EntityTags", ["tagId"], {
            name: "entity_tags_tag_lookup"
        });

        // Unique constraint para evitar duplicatas
        await queryInterface.addIndex("EntityTags", ["tagId", "entityType", "entityId"], {
            unique: true,
            name: "entity_tags_unique_assignment"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("EntityTags");
        await queryInterface.dropTable("Tags");
        await queryInterface.dropTable("TagGroups");
    }
};
