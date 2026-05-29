const { addColumnIfMissing, DataTypes } = require("./migrateUtil");

const USER_COLUMNS = [
  ["profession", { type: DataTypes.STRING, allowNull: true }],
  ["professionCategory", { type: DataTypes.STRING, allowNull: true }],
  ["homeCountry", { type: DataTypes.STRING, allowNull: true }],
  ["destinationCountry", { type: DataTypes.STRING, allowNull: true }],
  ["destinationCity", { type: DataTypes.STRING, allowNull: true }],
  ["moveDate", { type: DataTypes.DATEONLY, allowNull: true }],
  ["arrivalDate", { type: DataTypes.DATEONLY, allowNull: true }],
  ["visaType", { type: DataTypes.STRING, allowNull: true }],
  ["employerName", { type: DataTypes.STRING, allowNull: true }],
  ["familyStatus", { type: DataTypes.STRING, allowNull: true }],
  ["phase", { type: DataTypes.STRING, allowNull: true, defaultValue: "relocation" }],
  ["onboardingComplete", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
  ["concerns", { type: DataTypes.JSON, allowNull: true }],
  ["isMentor", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
  ["mentorVerified", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
  ["availabilityForMentorCalls", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
  ["languages", { type: DataTypes.JSON, allowNull: true }],
  ["previousCountries", { type: DataTypes.JSON, allowNull: true }],
  ["profilePublic", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }],
  ["lifeAbroadScore", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }],
  ["languageMilestone", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }],
];

/** Safe on every boot. Adds missing Users columns only (SQLite + Postgres). */
async function migrateExpatFields(sequelize) {
  for (const [name, definition] of USER_COLUMNS) {
    await addColumnIfMissing(sequelize, "Users", name, definition);
  }
}

module.exports = { migrateExpatFields };
