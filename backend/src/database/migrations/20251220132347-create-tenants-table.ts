import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
      .then(() => {
        return queryInterface.createTable('Tenants', {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false
          },
          status: {
            type: DataTypes.STRING,
            defaultValue: 'active',
            allowNull: false
          },
          plan: {
            type: DataTypes.STRING,
            defaultValue: 'free',
            allowNull: true
          },
          externalId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
          },
          maxUsers: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: true
          },
          maxConnections: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: true
          },
          logo: {
            type: DataTypes.STRING,
            allowNull: true
          },
          document: {
            type: DataTypes.STRING,
            allowNull: true
          },
          businessHours: {
            type: DataTypes.JSON,
            allowNull: true
          },
          message: {
            type: DataTypes.STRING,
            allowNull: true
          },
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
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
      });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable('Tenants');
  }
};
