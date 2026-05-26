const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MentorMatch = sequelize.define("MentorMatch", {
  mentorId: { type: DataTypes.INTEGER, allowNull: false },
  menteeId: { type: DataTypes.INTEGER, allowNull: false },
  destinationCountry: { type: DataTypes.STRING },
  destinationCity: { type: DataTypes.STRING },
  profession: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: "pending" },
  initiatedBy: { type: DataTypes.STRING, defaultValue: "system" },
});

module.exports = MentorMatch;
