import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Queues", "distributionMode", {
      type: DataTypes.ENUM("manual", "round-robin"),
      allowNull: false,
      defaultValue: "manual",
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Queues", "distributionMode");
  },
};
