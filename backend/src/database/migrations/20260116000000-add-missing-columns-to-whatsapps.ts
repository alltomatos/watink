import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "chatConfig", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "type", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "wpp"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "chatConfig"),
      queryInterface.removeColumn("Whatsapps", "type")
    ]);
  }
};
