const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define("Notification", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: true },
  data: { type: DataTypes.TEXT, allowNull: true },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  readAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = Notification;
