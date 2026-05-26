const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ForumSubscription = sequelize.define("ForumSubscription", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  spaceId: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = ForumSubscription;
