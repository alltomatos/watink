import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.addColumn("Whatsapps", "engineType", {
            type: DataTypes.ENUM("whaileys", "whatsmeow"),
            defaultValue: "whaileys",
            allowNull: false
        });
    },

    down: (queryInterface: QueryInterface) => {
        return queryInterface.removeColumn("Whatsapps", "engineType");
    }
};
