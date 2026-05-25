const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Single Event row: all fields required per product rules; createdBy ties post to User.id
const Event = sequelize.define("Event", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  location: { type: DataTypes.STRING, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = Event;
