import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Whatsapps", "syncHistory", {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: true
            }),
            queryInterface.addColumn("Whatsapps", "syncPeriod", {
                type: DataTypes.TEXT,
                allowNull: true
            })
        ]);
    },

    down: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Whatsapps", "syncHistory"),
            queryInterface.removeColumn("Whatsapps", "syncPeriod")
        ]);
    }
};
