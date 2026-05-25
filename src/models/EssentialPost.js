const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Community practical guides — Expat Essentials */
const EssentialPost = sequelize.define("EssentialPost", {
  title: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = EssentialPost;
