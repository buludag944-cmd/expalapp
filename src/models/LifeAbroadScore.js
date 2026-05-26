const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LifeAbroadScore = sequelize.define("LifeAbroadScore", {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  totalScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  legalStability: { type: DataTypes.INTEGER, defaultValue: 0 },
  careerProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
  financialHealth: { type: DataTypes.INTEGER, defaultValue: 0 },
  socialIntegration: { type: DataTypes.INTEGER, defaultValue: 0 },
  languageProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
  localRoots: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastCalculatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = LifeAbroadScore;
