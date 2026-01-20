import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const existing = await queryInterface.sequelize.query(
      `SELECT * FROM "Settings" WHERE key = 'userCreation'`
    );
    if ((existing[0] as any[]).length === 0) {
      return queryInterface.bulkInsert(
        "Settings",
        [
          {
            key: "userCreation",
            value: "enabled",
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        {}
      );
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.bulkDelete("Settings", {});
  }
};
