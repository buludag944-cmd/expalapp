const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Local tips / Q&A style posts — Local Know-How */
const KnowHowPost = sequelize.define("KnowHowPost", {
  title: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = KnowHowPost;
