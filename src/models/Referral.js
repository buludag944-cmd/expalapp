const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Referral = sequelize.define("Referral", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  profession: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
});

module.exports = Referral;
