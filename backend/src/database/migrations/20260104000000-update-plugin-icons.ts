import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Update 'clientes' plugin
    await queryInterface.sequelize.query(`
      UPDATE "Plugins"
      SET "iconUrl" = '/public/assets/icons/ico-crm.png'
      WHERE "slug" = 'clientes';
    `);

    // Update 'helpdesk' plugin
    await queryInterface.sequelize.query(`
      UPDATE "Plugins"
      SET "iconUrl" = '/public/assets/icons/ico-helpdesk.png'
      WHERE "slug" = 'helpdesk';
    `);


  },

  down: async (queryInterface: QueryInterface) => {
    // Revert to original URLs (optional, but good practice)
    await queryInterface.sequelize.query(`
      UPDATE "Plugins"
      SET "iconUrl" = 'https://plugins.watink.com/clientes/icon.png'
      WHERE "slug" = 'clientes';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Plugins"
      SET "iconUrl" = 'https://plugins.watink.com/helpdesk/icon.png'
      WHERE "slug" = 'helpdesk';
    `);


  }
};
