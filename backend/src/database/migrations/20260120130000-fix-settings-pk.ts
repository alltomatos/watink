import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // 1. Clean up null tenantIds first
        await queryInterface.sequelize.query('DELETE FROM "Settings" WHERE "tenantId" IS NULL');

        // 2. Remove existing PK using raw SQL to preserve current connection
        await queryInterface.sequelize.query('ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey"');

        // 3. Make tenantId NOT NULL and ensure it has correct FK
        await queryInterface.changeColumn('Settings', 'tenantId', {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'Tenants', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });

        // 4. Add composite PK using raw SQL
        await queryInterface.sequelize.query('ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("key", "tenantId")');
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.query('ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey"');

        await queryInterface.changeColumn('Settings', 'tenantId', {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'Tenants', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });

        await queryInterface.sequelize.query('ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("key")');
    }
};
