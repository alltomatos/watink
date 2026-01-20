import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Create Steps table for Kanban workflow
        await queryInterface.createTable("Steps", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            color: {
                type: DataTypes.STRING(20),
                allowNull: true,
                defaultValue: "#808080"
            },
            order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            isBindingStep: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "When true, moving a ticket to this step binds the contact to the assigned user wallet"
            },
            queueId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Queues",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            tenantId: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: "Tenants",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
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

        // Add indexes for common queries
        await queryInterface.addIndex("Steps", ["queueId", "order"], {
            name: "steps_queue_order_idx"
        });

        await queryInterface.addIndex("Steps", ["tenantId"], {
            name: "steps_tenant_id_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("Steps");
    }
};
