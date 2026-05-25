const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Housing = sequelize.define("Housing", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT },
  images: { type: DataTypes.JSON },
});

module.exports = Housing;
