const { addColumnIfMissing, DataTypes } = require("./migrateUtil");

/** Safe on every boot — columns for editing and soft-deleting a message. */
async function migrateMessageEdits(sequelize) {
  await addColumnIfMissing(sequelize, "Messages", "editedAt", {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await addColumnIfMissing(sequelize, "Messages", "deletedAt", {
    type: DataTypes.DATE,
    allowNull: true,
  });
}

module.exports = { migrateMessageEdits };
