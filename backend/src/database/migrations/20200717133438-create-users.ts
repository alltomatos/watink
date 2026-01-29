import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("Users", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
      },

      tokenVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      configs: {
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
      },
      socialName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      profileImage: {
        type: DataTypes.STRING,
        allowNull: true
      },
      lastAssignmentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      verificationToken: {
        type: DataTypes.STRING,
        allowNull: true
      },
      passwordResetToken: {
        type: DataTypes.STRING,
        allowNull: true
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Users");
  }
};
