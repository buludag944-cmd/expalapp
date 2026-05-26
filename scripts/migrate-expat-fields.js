#!/usr/bin/env node
/** CLI wrapper — same logic as server auto-migration on boot */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const sequelize = require("../src/config/database");
const { migrateExpatFields } = require("../src/migrations/migrateExpatFields");

(async () => {
  try {
    await migrateExpatFields(sequelize);
    console.log("[migrate] Expat fields OK");
  } catch (e) {
    console.error("[migrate] Failed:", e.message || e);
    process.exit(1);
  }
  await sequelize.close();
})();
