const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ForumReply = sequelize.define("ForumReply", {
  threadId: { type: DataTypes.INTEGER, allowNull: false },
  authorId: { type: DataTypes.INTEGER, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  upvotes: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = ForumReply;
