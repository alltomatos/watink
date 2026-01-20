import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.addColumn("QuickAnswers", "mediaType", {
                type: DataTypes.STRING,
                defaultValue: "text"
            }),
            queryInterface.addColumn("QuickAnswers", "dataJson", {
                type: DataTypes.TEXT,
                allowNull: true
            })
        ]);
    },

    down: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("QuickAnswers", "mediaType"),
            queryInterface.removeColumn("QuickAnswers", "dataJson")
        ]);
    }
};
