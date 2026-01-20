import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("ProtocolHistories", "changes", {
            type: DataTypes.TEXT,
            allowNull: true,
        });
    },

    down: async (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("ProtocolHistories", "changes");
    },
};
