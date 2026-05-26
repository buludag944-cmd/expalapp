/**
 * Reset database — removes SQLite files (clears orphaned Comments_backup WAL state) then recreates all tables from models.
 * Run from backend directory: npm run reset-db  (or node scripts/reset-db.js)
 * Use once after pulling schema changes when sync({ alter }) is not used.
 * To add columns without wiping data: npm run migrate:reset-columns
 */
const fs = require("fs");
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const backendRoot = path.join(__dirname, "..");
function removeSQLiteFiles() {
  for (const name of ["expal.db", "expal.db-wal", "expal.db-shm"]) {
    const p = path.join(backendRoot, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

// Remove files before Sequelize opens the DB (avoids SQLITE_BUSY / stale *_backup state).
removeSQLiteFiles();

const sequelize = require("../src/config/database");
require("../src/bootstrapModels");

(async () => {
  try {
    await sequelize.sync({ force: true });
    console.log("Database reset complete (fresh schema)");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  await sequelize.close();
  process.exit(0);
})();
