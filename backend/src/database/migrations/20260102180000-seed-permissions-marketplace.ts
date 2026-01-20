import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const now = new Date();
    const permissions = [
      {
        name: "view_marketplace",
        description: "Visualizar Marketplace",
        createdAt: now,
        updatedAt: now
      },
      {
        name: "edit_marketplace",
        description: "Editar Marketplace",
        createdAt: now,
        updatedAt: now
      }
    ];

    return queryInterface.bulkInsert("Permissions", permissions, { ignoreDuplicates: true } as any);
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.bulkDelete(
      "Permissions",
      { name: ["view_marketplace", "edit_marketplace"] },
      {}
    );
  }
};
