const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Added email verification (isVerified + verifyToken)
const User = sequelize.define("User", {
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  verifyToken: { type: DataTypes.STRING(128), allowNull: true },
  verifyTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  // Password reset token (one-time), expires in 60 minutes.
  resetToken: { type: DataTypes.STRING(128), allowNull: true },
  resetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  nationality: { type: DataTypes.STRING },
  currentCity: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  interests: { type: DataTypes.JSON }, // array of interests stored as JSON
  industry: { type: DataTypes.STRING },
  bio: { type: DataTypes.TEXT },
  profileImage: { type: DataTypes.TEXT }, // base64 or URL
});

module.exports = User;

