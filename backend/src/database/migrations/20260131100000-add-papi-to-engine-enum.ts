import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Whatsapps_engineType" ADD VALUE 'papi';`);
    } catch (e) {
      // Ignore if already exists
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Cannot remove value from enum easily
  }
};
