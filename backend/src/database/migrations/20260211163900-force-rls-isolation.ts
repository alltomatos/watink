import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Get all tables with tenantId column in public schema
    const results = await queryInterface.sequelize.query(`
      SELECT c.table_name 
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE c.column_name = 'tenantId' 
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      UNION
      SELECT 'Tenants' as table_name;
    `, { type: 'SELECT' }) as any[];

    // Extract table names
    const tables = results.map((r: any) => r.table_name);

    console.log(`Enabling FORCE RLS on tables: ${tables.join(', ')}`);

    for (const table of tables) {
      try {
        // 2. Enable RLS
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        
        // 3. Force RLS (Owner also subject to RLS)
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);

        // 4. Drop existing policy if exists and create new one
        await queryInterface.sequelize.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
        
        // Use current_setting('app.current_tenant', true) 
        // The 'true' parameter ensures it returns NULL instead of error if not set
        let policySql;
        if (table === 'Tenants') {
            policySql = `
              CREATE POLICY "${table}_tenant_isolation" ON "${table}"
              USING (id::text = current_setting('app.current_tenant', true));
            `;
        } else {
            policySql = `
              CREATE POLICY "${table}_tenant_isolation" ON "${table}"
              USING ("tenantId"::text = current_setting('app.current_tenant', true));
            `;
        }
        
        await queryInterface.sequelize.query(policySql);
        
        console.log(`Successfully applied FORCE RLS to ${table}`);
      } catch (error) {
        console.error(`Error applying RLS to ${table}:`, error);
      }
    }

    // 5. Ensure app user doesn't have BYPASSRLS
    try {
      const [userRes] = await queryInterface.sequelize.query("SELECT current_user as \"user\";") as any[];
      const currentUser = userRes[0].user;
      
      console.log(`Removing BYPASSRLS from current user: ${currentUser}`);
      await queryInterface.sequelize.query(`ALTER ROLE "${currentUser}" NOBYPASSRLS;`);
      
      // Also try for 'postgres' explicitly if it's the common app user
      if (currentUser !== 'postgres') {
          await queryInterface.sequelize.query(`ALTER ROLE "postgres" NOBYPASSRLS;`).catch(() => {});
      }
    } catch (error) {
      console.error("Error updating user attributes:", error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const results = await queryInterface.sequelize.query(`
      SELECT c.table_name 
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE c.column_name = 'tenantId' 
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      UNION
      SELECT 'Tenants' as table_name;
    `, { type: 'SELECT' }) as any[];

    const tables = results.map((r: any) => r.table_name);

    for (const table of tables) {
      try {
        await queryInterface.sequelize.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY;`);
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
      } catch (error) {
        console.error(`Error reverting RLS on ${table}:`, error);
      }
    }
  }
};
