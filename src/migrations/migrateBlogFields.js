const { addColumnIfMissing, DataTypes } = require("./migrateUtil");

/** Safe on every boot — BlogPosts.tags for journal chips. */
async function migrateBlogFields(sequelize) {
  await addColumnIfMissing(sequelize, "BlogPosts", "tags", {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "[]",
  });
}

module.exports = { migrateBlogFields };
