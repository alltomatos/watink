import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "configs", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        dashboard: {
          widgets: [
            { id: "tickets_info", visible: true, width: 4, order: 1 },
            { id: "attendance_chart", visible: true, width: 8, order: 2 },
          ]
        }
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "configs");
  }
};
