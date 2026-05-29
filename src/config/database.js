const { Sequelize } = require("sequelize");
const path = require("path");

function getDatabaseConfig() {
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  if (databaseUrl) {
    const useSsl =
      process.env.DB_SSL !== "false" &&
      !databaseUrl.includes("localhost") &&
      !databaseUrl.includes("127.0.0.1");
    return {
      sequelize: new Sequelize(databaseUrl, {
        dialect: "postgres",
        dialectOptions: useSsl
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
        logging: false,
      }),
      meta: { dialect: "postgres", persistent: true, storage: "DATABASE_URL" },
    };
  }

  const storage =
    process.env.DATABASE_PATH ||
    path.resolve(__dirname, "../../expal.db");

  const onRender = process.env.RENDER === "true";
  const persistent = !!process.env.DATABASE_PATH || !onRender;

  return {
    sequelize: new Sequelize({
      dialect: "sqlite",
      storage,
      logging: false,
    }),
    meta: { dialect: "sqlite", persistent, storage },
  };
}

const { sequelize, meta } = getDatabaseConfig();

module.exports = sequelize;
module.exports.dbMeta = meta;
