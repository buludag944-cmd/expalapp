const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Added email verification (isVerified + verifyToken)
const User = sequelize.define("User", {
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  authProvider: { type: DataTypes.STRING, allowNull: false, defaultValue: "email" },
  firebaseUid: { type: DataTypes.STRING, allowNull: true, unique: true },
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
  // Expat journey fields
  profession: { type: DataTypes.STRING },
  professionCategory: { type: DataTypes.STRING },
  homeCountry: { type: DataTypes.STRING },
  destinationCountry: { type: DataTypes.STRING },
  destinationCity: { type: DataTypes.STRING },
  moveDate: { type: DataTypes.DATEONLY },
  arrivalDate: { type: DataTypes.DATEONLY },
  visaType: { type: DataTypes.STRING },
  employerName: { type: DataTypes.STRING },
  employmentStatus: { type: DataTypes.STRING },
  familyStatus: { type: DataTypes.STRING },
  phase: { type: DataTypes.STRING, defaultValue: "relocation" },
  onboardingComplete: { type: DataTypes.BOOLEAN, defaultValue: false },
  concerns: { type: DataTypes.JSON },
  isMentor: { type: DataTypes.BOOLEAN, defaultValue: false },
  mentorVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  availabilityForMentorCalls: { type: DataTypes.BOOLEAN, defaultValue: false },
  languages: { type: DataTypes.JSON },
  previousCountries: { type: DataTypes.JSON },
  profilePublic: { type: DataTypes.BOOLEAN, defaultValue: true },
  lifeAbroadScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  languageMilestone: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = User;

