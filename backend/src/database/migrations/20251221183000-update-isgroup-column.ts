import { QueryInterface } from "sequelize";

module.exports = {
    up: (queryInterface: QueryInterface) => {
        return queryInterface.sequelize.query(
            `UPDATE "Contacts" SET "isGroup" = true WHERE "number" LIKE '%g.us' AND "isGroup" = false;`
        );
    },

    down: (queryInterface: QueryInterface) => {
        // No rollback needed for data correction but technically we could revert if we tracked IDs.
        // implementing no-op for down as this is a data fix
        return Promise.resolve();
    }
};
