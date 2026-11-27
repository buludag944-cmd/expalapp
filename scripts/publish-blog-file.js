#!/usr/bin/env node
/**
 * Publish one markdown article to the live blog.
 * Usage: node scripts/publish-blog-file.js content/blog/my-article.md
 * Needs BLOG_PUBLISH_TOKEN. The API base defaults to the live Render service.
 */
const fs = require("fs");
const { parseBlogArticle } = require("../src/lib/blogArticleFile");

async function publishBlogFile(filePath, { token, apiUrl, fetchImpl = fetch } = {}) {
  const article = parseBlogArticle(fs.readFileSync(filePath, "utf8"));
  const base = String(apiUrl || "https://expalapp-1.onrender.com").replace(/\/$/, "");
  const response = await fetchImpl(`${base}/api/blog/by-slug/${encodeURIComponent(article.slug)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      tags: article.tags,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      published: article.published,
    }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const detail = json && json.error ? json.error : text.slice(0, 200);
    throw new Error(`Publish failed (${response.status}) for ${article.slug}: ${detail}`);
  }
  return json;
}

async function main() {
  const files = process.argv.slice(2).filter((name) => name.endsWith(".md") && !name.endsWith("README.md"));
  const token = process.env.BLOG_PUBLISH_TOKEN || "";
  if (!files.length) {
    console.log("No article files to publish.");
    return;
  }
  if (!token) {
    console.error("BLOG_PUBLISH_TOKEN is not set. Add it in Render and in the GitHub Actions secret.");
    process.exit(1);
  }
  for (const filePath of files) {
    const saved = await publishBlogFile(filePath, { token, apiUrl: process.env.BLOG_API_URL });
    console.log(`${saved.published ? "Published" : "Saved draft"} ${saved.slug}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { publishBlogFile };
