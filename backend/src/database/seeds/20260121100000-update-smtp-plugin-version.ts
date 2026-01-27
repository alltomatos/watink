import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE "Plugins" SET "version" = '1.0.7', "updatedAt" = NOW() WHERE "slug" = 'smtp';`
    );
    console.log("SMTP Plugin version updated to 1.0.7 in Plugins table.");
  },

  down: async (queryInterface: QueryInterface) => {
     // Optional: Revert to previous known version if needed
     // await queryInterface.sequelize.query(
     //   `UPDATE "Plugins" SET "version" = '1.0.6' WHERE "slug" = 'smtp';`
     // );
  }
};
