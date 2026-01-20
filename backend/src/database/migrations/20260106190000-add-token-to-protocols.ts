import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("Protocols", "token", {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: DataTypes.UUIDV4 // This will backfill existing rows
        });
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("Protocols", "token");
    }
};
