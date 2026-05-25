// models/Comment.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// THREAD_TYPES: use STRING + validate instead of Sequelize ENUM —
// SQLite stores ENUM via CHECK constraints; adding "referral" often leaves old DB schemas
// rejecting inserts. STRING + isIn behaves the same at app level and alters cleanly.
const THREAD_TYPES = ["event", "listing", "referral", "essential", "knowhow"];

const Comment = sequelize.define("Comment", {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false,
  }, // Stores commenter email; clients use mailto:author while showing authorName where possible.
  // Full-name label for display (optional on legacy rows until resolved at read time).
  authorName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Thread key: event row, Housing row, or Referral row
  targetType: {
    type: DataTypes.STRING(32),
    allowNull: false,
    validate: {
      isIn: {
        args: [THREAD_TYPES],
        msg: "Invalid targetType. Must be event, listing, referral, essential, or knowhow.",
      },
    },
  },
  targetId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

module.exports = Comment;
module.exports.THREAD_TYPES = THREAD_TYPES;
