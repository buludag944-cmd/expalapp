const { addColumnIfMissing, DataTypes } = require("./migrateUtil");

const USER_COLUMNS = [
  ["authProvider", { type: DataTypes.STRING, allowNull: false, defaultValue: "email" }],
  // No UNIQUE on ALTER (SQLite cannot add UNIQUE columns); fresh DBs get unique from User model.
  ["firebaseUid", { type: DataTypes.STRING, allowNull: true }],
];

async function migrateGoogleAuth(sequelize) {
  for (const [name, definition] of USER_COLUMNS) {
    await addColumnIfMissing(sequelize, "Users", name, definition);
  }
}

module.exports = { migrateGoogleAuth };
