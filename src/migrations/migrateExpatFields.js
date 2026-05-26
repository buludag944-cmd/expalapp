const { QueryTypes } = require("sequelize");

const COLUMNS = [
  ["profession", "TEXT"],
  ["professionCategory", "TEXT"],
  ["homeCountry", "TEXT"],
  ["destinationCountry", "TEXT"],
  ["destinationCity", "TEXT"],
  ["moveDate", "DATE"],
  ["arrivalDate", "DATE"],
  ["visaType", "TEXT"],
  ["employerName", "TEXT"],
  ["familyStatus", "TEXT"],
  ["phase", "TEXT DEFAULT 'relocation'"],
  ["onboardingComplete", "TINYINT(1) DEFAULT 0"],
  ["concerns", "TEXT"],
  ["isMentor", "TINYINT(1) DEFAULT 0"],
  ["mentorVerified", "TINYINT(1) DEFAULT 0"],
  ["availabilityForMentorCalls", "TINYINT(1) DEFAULT 0"],
  ["languages", "TEXT"],
  ["previousCountries", "TEXT"],
  ["profilePublic", "TINYINT(1) DEFAULT 1"],
  ["lifeAbroadScore", "INTEGER DEFAULT 0"],
  ["languageMilestone", "INTEGER DEFAULT 0"],
];

async function columnExists(sequelize, table, name) {
  const rows = await sequelize.query(`PRAGMA table_info(${table});`, {
    type: QueryTypes.SELECT,
  });
  return rows.some((r) => r.name === name);
}

/** Safe to run on every boot (Render has no Shell). Adds missing Users columns only. */
async function migrateExpatFields(sequelize) {
  for (const [name, type] of COLUMNS) {
    if (!(await columnExists(sequelize, "Users", name))) {
      await sequelize.query(`ALTER TABLE Users ADD COLUMN ${name} ${type};`);
      console.log(`[migrate] Added Users.${name}`);
    }
  }
}

module.exports = { migrateExpatFields };
