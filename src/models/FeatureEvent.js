const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FeatureEvent = sequelize.define("FeatureEvent", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  feature: { type: DataTypes.STRING },
  action: { type: DataTypes.STRING },
  phase: { type: DataTypes.STRING },
});

module.exports = FeatureEvent;
