const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AbsenceLog = sequelize.define("AbsenceLog", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  fromDate: { type: DataTypes.DATEONLY, allowNull: false },
  toDate: { type: DataTypes.DATEONLY, allowNull: false },
  days: { type: DataTypes.INTEGER },
  reason: { type: DataTypes.STRING },
});

module.exports = AbsenceLog;
