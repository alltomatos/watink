import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("Whatsapps", "keepAlive", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true
        });
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("Whatsapps", "keepAlive");
    }
};
