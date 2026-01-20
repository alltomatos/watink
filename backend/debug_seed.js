const { Sequelize } = require("sequelize");
const dbConfig = require("./dist/config/database");

const sequelize = new Sequelize(dbConfig);

(async () => {
    try {
        const tenants = await sequelize.query("SELECT id FROM \"Tenants\";", { type: Sequelize.QueryTypes.SELECT });
        console.log("Tenants found:", JSON.stringify(tenants, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
})();
