"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const up = async (queryInterface) => {
    const timezoneSetting = await queryInterface.rawSelect("Settings", {
        where: {
            key: "timezone"
        }
    }, ["key"]);
    if (!timezoneSetting) {
        await queryInterface.bulkInsert("Settings", [
            {
                key: "timezone",
                value: "-03:00",
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);
    }
};
exports.up = up;
const down = async (queryInterface) => {
    await queryInterface.bulkDelete("Settings", { key: "timezone" });
};
exports.down = down;
