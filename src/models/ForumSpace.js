const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ForumSpace = sequelize.define("ForumSpace", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  countryTag: { type: DataTypes.BOOLEAN, defaultValue: false },
  phaseTag: { type: DataTypes.STRING },
});

module.exports = ForumSpace;
