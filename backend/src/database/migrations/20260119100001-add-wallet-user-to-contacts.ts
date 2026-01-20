import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Add wallet_user_id to Contacts table
        await queryInterface.addColumn("Contacts", "walletUserId", {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: {
                model: "Users",
                key: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
        });

        // Add index for performance on wallet lookups
        await queryInterface.addIndex("Contacts", ["walletUserId"], {
            name: "contacts_wallet_user_id_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.removeIndex("Contacts", "contacts_wallet_user_id_idx");
        await queryInterface.removeColumn("Contacts", "walletUserId");
    }
};
