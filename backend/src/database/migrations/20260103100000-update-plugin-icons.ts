import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkUpdate("Plugins",
      { iconUrl: "/assets/plugins/clientes/icon.png" },
      { slug: "clientes" }
    );

    await queryInterface.bulkUpdate("Plugins",
      { iconUrl: "/assets/plugins/helpdesk/icon.png" },
      { slug: "helpdesk" }
    );


  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkUpdate("Plugins",
      { iconUrl: "https://plugins.watink.com/clientes/icon.png" },
      { slug: "clientes" }
    );

    await queryInterface.bulkUpdate("Plugins",
      { iconUrl: "https://plugins.watink.com/helpdesk/icon.png" },
      { slug: "helpdesk" }
    );


  }
};
