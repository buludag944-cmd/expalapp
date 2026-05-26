#!/usr/bin/env node
/**
 * One-time SQLite migration: add resetToken + resetTokenExpiresAt to Users if missing.
 * Preserves existing rows (unlike npm run reset-db). Safe to run multiple times.
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
    const table = "Users";
    let changed = false;

    if (!(await columnExists(table, "resetToken"))) {
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN resetToken VARCHAR(128);"
      );
      console.log("[migrate] Added Users.resetToken");
      changed = true;
    } else {
      console.log("[migrate] Users.resetToken already exists");
    }

    if (!(await columnExists(table, "resetTokenExpiresAt"))) {
      await sequelize.query(
        "ALTER TABLE Users ADD COLUMN resetTokenExpiresAt DATETIME;"
      );
      console.log("[migrate] Added Users.resetTokenExpiresAt");
      changed = true;
    } else {
      console.log("[migrate] Users.resetTokenExpiresAt already exists");
    }

    if (!changed) {
      console.log("[migrate] Schema already up to date.");
    } else {
      console.log("[migrate] Password reset columns ready.");
    }
  } catch (e) {
    console.error("[migrate] Failed:", e.message || e);
    process.exit(1);
  }
  await sequelize.close();
  process.exit(0);
})();
