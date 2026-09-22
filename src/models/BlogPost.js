const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Public marketing blog posts for SEO (admin-authored). */
const BlogPost = sequelize.define(
  "BlogPost",
  {
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    excerpt: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "" },
    body: { type: DataTypes.TEXT, allowNull: false },
    coverImageUrl: { type: DataTypes.STRING, allowNull: true },
    seoTitle: { type: DataTypes.STRING, allowNull: true },
    seoDescription: { type: DataTypes.STRING(320), allowNull: true },
    tags: { type: DataTypes.TEXT, allowNull: true, defaultValue: "[]" },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
    authorId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    indexes: [{ unique: true, fields: ["slug"] }, { fields: ["published", "publishedAt"] }],
  }
);

module.exports = BlogPost;
