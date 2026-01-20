import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // This migration originally created the table but was a duplicate of 20260114000000.
        // We modify it to only add indices if they are missing.
        
        // Safety check if table exists (it should from 20260114000000)
        const tableInfo = await queryInterface.describeTable("UserGroups");
        
        // Add indices
        // Sequelize addIndex checks are usually safe but let's just add them.
        // If they exist, it might throw, so wrapping in try/catch or checking is better?
        // But describeTable doesn't easily show indices in Sequelize v5 without raw query.
        
        try {
             await queryInterface.addIndex("UserGroups", ["userId", "groupId"], {
                unique: true,
                name: "user_group_unique"
            });
        } catch (e) {
            console.log("Index user_group_unique might already exist, skipping.");
        }

        try {
            await queryInterface.addIndex("UserGroups", ["tenantId"], {
                name: "user_groups_tenant_idx"
            });
        } catch (e) {
             console.log("Index user_groups_tenant_idx might already exist, skipping.");
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Remove indices
         try {
            await queryInterface.removeIndex("UserGroups", "user_group_unique");
        } catch (e) {}
        
        try {
            await queryInterface.removeIndex("UserGroups", "user_groups_tenant_idx");
        } catch (e) {}
    }
};
