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

    await queryInterface.bulkUpdate("Plugins", 
      { iconUrl: "/assets/plugins/whatsmeow/icon.png" },
      { slug: "whatsmeow" }
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

    await queryInterface.bulkUpdate("Plugins", 
      { iconUrl: "https://plugins.watink.com/whatsmeow/icon.png" },
      { slug: "whatsmeow" }
    );
  }
};
