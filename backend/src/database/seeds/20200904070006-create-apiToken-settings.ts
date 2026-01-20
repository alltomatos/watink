import { QueryInterface } from "sequelize";
import { v4 as uuidv4 } from "uuid";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const existing = await queryInterface.sequelize.query(
      `SELECT * FROM "Settings" WHERE key = 'userApiToken'`
    );
    if ((existing[0] as any[]).length === 0) {
      return queryInterface.bulkInsert(
        "Settings",
        [
          {
            key: "userApiToken",
            value: uuidv4(),
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
