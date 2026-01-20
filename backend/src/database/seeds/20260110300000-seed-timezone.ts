import { QueryInterface } from "sequelize";

export const up = async (queryInterface: QueryInterface) => {
    // Use QueryTypes.SELECT to ensure we get just the results array
    const tenants = await queryInterface.sequelize.query(
        "SELECT id FROM \"Tenants\";",
        {
            type: (queryInterface.sequelize as any).QueryTypes.SELECT
        }
    );

    const tenantList = Array.isArray(tenants) && Array.isArray((tenants as any)[0])
        ? (tenants as any)[0]
        : tenants;

    for (const tenant of (tenantList as any[])) {
        // If tenant is metadata or malformed, skip
        if (!tenant || !tenant.id) continue;

        const tenantId = tenant.id;

        // Check if timezone setting exists for this tenant
        const timezoneSetting = await queryInterface.rawSelect(
            "Settings",
            {
                where: {
                    key: "timezone",
                    tenantId: tenantId
                }
            },
            ["key"]
        );

        if (!timezoneSetting) {
            await queryInterface.bulkInsert("Settings", [
                {
                    key: "timezone",
                    value: "-03:00",
                    tenantId: tenantId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
        }
    }
};

export const down = async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("Settings", { key: "timezone" });
};
