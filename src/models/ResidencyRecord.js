const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ResidencyRecord = sequelize.define("ResidencyRecord", {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  country: { type: DataTypes.STRING },
  visaType: { type: DataTypes.STRING },
  visaStartDate: { type: DataTypes.DATEONLY },
  visaExpiryDate: { type: DataTypes.DATEONLY },
  prEligibilityDate: { type: DataTypes.DATEONLY },
  citizenshipEligibilityDate: { type: DataTypes.DATEONLY },
  daysRequiredForPr: { type: DataTypes.INTEGER },
  daysPresentInCountry: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = ResidencyRecord;
