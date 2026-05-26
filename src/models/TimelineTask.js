const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TimelineTask = sequelize.define("TimelineTask", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  dueOffsetDays: { type: DataTypes.INTEGER },
  dueDate: { type: DataTypes.DATEONLY },
  phase: { type: DataTypes.STRING },
  isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  completedAt: { type: DataTypes.DATE },
});

module.exports = TimelineTask;
