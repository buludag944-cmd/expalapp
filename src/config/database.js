const { Sequelize } = require("sequelize");
const path = require("path");

// Local: backend/expal.db — Railway: mount a volume at /data and set DATABASE_PATH=/data/expal.db
const storage =
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, "../../expal.db");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage,
  logging: false,
});

module.exports = sequelize;
