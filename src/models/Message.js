const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Message = sequelize.define("Message", {
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Message;
