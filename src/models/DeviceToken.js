const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DeviceToken = sequelize.define(
  "DeviceToken",
  {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    fcmToken: { type: DataTypes.STRING(512), allowNull: false, unique: true },
    platform: { type: DataTypes.STRING(32), allowNull: true },
  },
  {
    indexes: [{ fields: ["userId"] }],
  }
);

module.exports = DeviceToken;
