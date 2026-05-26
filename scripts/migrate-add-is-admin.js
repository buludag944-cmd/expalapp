#!/usr/bin/env node
/**
 * One-time SQLite migration: add isAdmin to Users if missing.
 * Preserves rows. Safe to re-run. Alternative: npm run reset-db
 */
const path = require("path");
const { QueryTypes } = require("sequelize");

process.chdir(path.join(__dirname, ".."));

const sequelize = require("../src/config/database");

async function columnExists(table, name) {
  const rows = await sequelize.query(`PRAGMA table_info(${table});`, {
    type: QueryTypes.SELECT,
  });
  return rows.some((r) => r.name === name);
}

(async () => {
  try {
    if (!(await columnExists("Users", "isAdmin"))) {
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN isAdmin TINYINT(1) NOT NULL DEFAULT 0;"
      );
      console.log("[migrate] Added Users.isAdmin");
    } else {
      console.log("[migrate] Users.isAdmin already exists");
    }
  } catch (e) {
    console.error("[migrate] Failed:", e.message || e);
    process.exit(1);
  }
  await sequelize.close();
  process.exit(0);
})();
