const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Document = sequelize.define("Document", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  documentType: { type: DataTypes.STRING },
  fileUrl: { type: DataTypes.TEXT },
  expiryDate: { type: DataTypes.DATEONLY },
  alertSent: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Document;
