const { QueryTypes } = require("sequelize");

const COLUMNS = [
  ["authProvider", "TEXT DEFAULT 'email'"],
  ["firebaseUid", "TEXT"],
];

async function columnExists(sequelize, table, name) {
  const rows = await sequelize.query(`PRAGMA table_info(${table});`, {
    type: QueryTypes.SELECT,
  });
  return rows.some((r) => r.name === name);
}

async function migrateGoogleAuth(sequelize) {
  for (const [name, type] of COLUMNS) {
    if (!(await columnExists(sequelize, "Users", name))) {
      await sequelize.query(`ALTER TABLE Users ADD COLUMN ${name} ${type};`);
      console.log(`[migrate] Added Users.${name}`);
    }
  }
}

module.exports = { migrateGoogleAuth };
