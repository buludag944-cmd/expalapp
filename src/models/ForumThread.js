const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ForumThread = sequelize.define("ForumThread", {
  spaceId: { type: DataTypes.INTEGER, allowNull: false },
  authorId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  countryTag: { type: DataTypes.STRING },
  cityTag: { type: DataTypes.STRING },
  professionTag: { type: DataTypes.STRING },
  phaseTag: { type: DataTypes.STRING },
  pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  replyCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastActivityAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = ForumThread;
