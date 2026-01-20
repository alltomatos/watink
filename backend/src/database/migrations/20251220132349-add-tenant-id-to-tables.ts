import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    const tables = [
      'Users',
      'Contacts',
      'Tickets',
      'Messages',
      'Whatsapps',
      'Queues',
      'QuickAnswers',
      'Settings'
    ];

    return Promise.all(tables.map(table => {
      return queryInterface.addColumn(table, 'tenantId', {
        type: DataTypes.UUID,
        references: { model: 'Tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        allowNull: true // Initially nullable to allow migration of existing data
      }).then(() => {
        return queryInterface.addIndex(table, ['tenantId']);
      });
    }));
  },

  down: (queryInterface: QueryInterface) => {
    const tables = [
      'Users',
      'Contacts',
      'Tickets',
      'Messages',
      'Whatsapps',
      'Queues',
      'QuickAnswers',
      'Settings'
    ];

    return Promise.all(tables.map(table => {
      return queryInterface.removeColumn(table, 'tenantId');
    }));
  }
};
