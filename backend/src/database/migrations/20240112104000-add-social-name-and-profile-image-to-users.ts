import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const tableInfo: any = await queryInterface.describeTable("Users");

        const promises = [];

        if (!tableInfo["socialName"]) {
            promises.push(
                queryInterface.addColumn("Users", "socialName", {
                    type: DataTypes.STRING,
                    allowNull: true
                })
            );
        }

        if (!tableInfo["profileImage"]) {
            promises.push(
                queryInterface.addColumn("Users", "profileImage", {
                    type: DataTypes.STRING,
                    allowNull: true
                })
            );
        }

        return Promise.all(promises);
    },

    down: (queryInterface: QueryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Users", "socialName"),
            queryInterface.removeColumn("Users", "profileImage")
        ]);
    }
};
