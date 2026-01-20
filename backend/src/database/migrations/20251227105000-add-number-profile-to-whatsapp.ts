import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "number", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "profilePicUrl", {
        type: DataTypes.STRING,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "number"),
      queryInterface.removeColumn("Whatsapps", "profilePicUrl")
    ]);
  }
};
