import { QueryInterface, DataTypes, Sequelize } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // 1. Add new columns to Queues
            await queryInterface.addColumn(
                "Queues",
                "distributionStrategy",
                {
                    type: DataTypes.STRING(50),
                    allowNull: false,
                    defaultValue: "MANUAL",
                    validate: {
                        isIn: [["MANUAL", "AUTO_ROUND_ROBIN", "AUTO_BALANCED"]]
                    }
                },
                { transaction }
            );

            await queryInterface.addColumn(
                "Queues",
                "prioritizeWallet",
                {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                { transaction }
            );

            // 2. Migrate data from old distributionMode to new distributionStrategy
            await queryInterface.sequelize.query(
                `UPDATE "Queues" 
         SET "distributionStrategy" = CASE 
           WHEN "distributionMode" = 'manual' THEN 'MANUAL'
           WHEN "distributionMode" = 'round-robin' THEN 'AUTO_ROUND_ROBIN'
           ELSE 'MANUAL'
         END
         WHERE "distributionMode" IS NOT NULL`,
                { transaction }
            );

            // 3. Remove old ENUM column (safely)
            await queryInterface.removeColumn("Queues", "distributionMode", { transaction });

            // 4. Drop the old ENUM type if it exists
            await queryInterface.sequelize.query(
                `DROP TYPE IF EXISTS "enum_Queues_distributionMode"`,
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface: QueryInterface) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Recreate old ENUM type
            await queryInterface.sequelize.query(
                `CREATE TYPE "enum_Queues_distributionMode" AS ENUM ('manual', 'round-robin')`,
                { transaction }
            );

            // Add back old column
            await queryInterface.addColumn(
                "Queues",
                "distributionMode",
                {
                    type: DataTypes.ENUM("manual", "round-robin"),
                    allowNull: false,
                    defaultValue: "manual"
                },
                { transaction }
            );

            // Migrate data back
            await queryInterface.sequelize.query(
                `UPDATE "Queues" 
         SET "distributionMode" = CASE 
           WHEN "distributionStrategy" = 'MANUAL' THEN 'manual'::"enum_Queues_distributionMode"
           WHEN "distributionStrategy" = 'AUTO_ROUND_ROBIN' THEN 'round-robin'::"enum_Queues_distributionMode"
           ELSE 'manual'::"enum_Queues_distributionMode"
         END`,
                { transaction }
            );

            // Remove new columns
            await queryInterface.removeColumn("Queues", "distributionStrategy", { transaction });
            await queryInterface.removeColumn("Queues", "prioritizeWallet", { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
