const { DataTypes } = require("sequelize");

/** Works on SQLite and Postgres (no PRAGMA). */
async function describeTableSafe(sequelize, table) {
  try {
    return await sequelize.getQueryInterface().describeTable(table);
  } catch {
    return null;
  }
}

async function columnExists(sequelize, table, name) {
  const desc = await describeTableSafe(sequelize, table);
  if (!desc) return false;
  return Object.prototype.hasOwnProperty.call(desc, name);
}

async function addColumnIfMissing(sequelize, table, name, definition) {
  if (await columnExists(sequelize, table, name)) return false;
  await sequelize.getQueryInterface().addColumn(table, name, definition);
  console.log(`[migrate] Added ${table}.${name}`);
  return true;
}

module.exports = {
  describeTableSafe,
  columnExists,
  addColumnIfMissing,
  DataTypes,
};
