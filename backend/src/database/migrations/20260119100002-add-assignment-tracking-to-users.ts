import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Add lastAssignmentAt to Users table for distribution fairness
        await queryInterface.addColumn("Users", "lastAssignmentAt", {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });

        // Add index for efficient sorting in distribution queries
        await queryInterface.addIndex("Users", ["lastAssignmentAt"], {
            name: "users_last_assignment_at_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeIndex("Users", "users_last_assignment_at_idx");
        await queryInterface.removeColumn("Users", "lastAssignmentAt");
    }
};
