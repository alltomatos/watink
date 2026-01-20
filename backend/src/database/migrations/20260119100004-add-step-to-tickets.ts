import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Add stepId to Tickets table
        await queryInterface.addColumn("Tickets", "stepId", {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: {
                model: "Steps",
                key: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
        });

        // Add index for step-based queries
        await queryInterface.addIndex("Tickets", ["stepId"], {
            name: "tickets_step_id_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeIndex("Tickets", "tickets_step_id_idx");
        await queryInterface.removeColumn("Tickets", "stepId");
    }
};
