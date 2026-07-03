const { addColumnIfMissing, DataTypes } = require("./migrateUtil");

const USER_COLUMNS = [
  ["employmentStatus", { type: DataTypes.STRING, allowNull: true }],
];

const RESIDENCY_COLUMNS = [
  ["irpApplicationDate", { type: DataTypes.DATEONLY, allowNull: true }],
  ["irpExpectedWeeks", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 }],
];

async function migrateEmploymentAndIrp(sequelize) {
  for (const [name, definition] of USER_COLUMNS) {
    await addColumnIfMissing(sequelize, "Users", name, definition);
  }
  for (const [name, definition] of RESIDENCY_COLUMNS) {
    await addColumnIfMissing(sequelize, "ResidencyRecords", name, definition);
  }
}

module.exports = { migrateEmploymentAndIrp };
