import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
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

    // Enable RLS for each table
    for (const table of tables) {
      await queryInterface.sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      
      // Create Policy: Tenant Isolation
      // Users can only see rows where tenantId matches their session's current_tenant
      await queryInterface.sequelize.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
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

    for (const table of tables) {
      await queryInterface.sequelize.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
      await queryInterface.sequelize.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
    }
  }
};
