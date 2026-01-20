require("../bootstrap");

module.exports = {
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: "-03:00",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_USE_SSL === "true" ? { require: true, rejectUnauthorized: false } : false,
  },
};
