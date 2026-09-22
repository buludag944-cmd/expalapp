/**
 * Public blog + admin CRUD for SEO marketing posts.
 *
 * Public:
 *   GET  /api/blog              — published posts (optional ?limit=)
 *   GET  /api/blog/sitemap.xml  — XML sitemap for Google
 *   GET  /api/blog/:slug        — one published post
 *
 * Admin (Bearer + requireAdmin):
 *   GET    /api/blog/admin/all
 *   POST   /api/blog
 *   PUT    /api/blog/:id
 *   DELETE /api/blog/:id
 */
const express = require("express");
const { Op } = require("sequelize");
const { BlogPost, User } = require("../bootstrapModels");
const { verifyToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

function clientBaseUrl() {
  return (process.env.CLIENT_URL || "https://expalapp.netlify.app").replace(/\/$/, "");
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base) || `post-${Date.now()}`;
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await BlogPost.findOne({ where: { slug: candidate } });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }
    n += 1;
  }
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function tagsToStore(raw) {
  const tags = parseTags(raw);
  return JSON.stringify(tags);
}

function serializePost(post, { includeBody = true } = {}) {
  const plain = post.toJSON ? post.toJSON() : post;
  const author = plain.Author || plain.author;
  const out = {
    id: plain.id,
    title: plain.title,
    slug: plain.slug,
    excerpt: plain.excerpt,
    coverImageUrl: plain.coverImageUrl || null,
    seoTitle: plain.seoTitle || null,
    seoDescription: plain.seoDescription || null,
    tags: parseTags(plain.tags),
    published: !!plain.published,
    publishedAt: plain.publishedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    author: author
      ? {
          id: author.id,
          firstName: author.firstName,
          lastName: author.lastName,
        }
      : null,
  };
  if (includeBody) out.body = plain.body;
  return out;
}

const authorInclude = {
  model: User,
  as: "Author",
  attributes: ["id", "firstName", "lastName"],
};

/** GET /api/blog — published list */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const rows = await BlogPost.findAll({
      where: { published: true },
      order: [
        ["publishedAt", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      include: [authorInclude],
    });
    res.json(rows.map((r) => serializePost(r, { includeBody: false })));
  } catch (err) {
    console.error("[blog] list", err.message || err);
    res.status(500).json({ error: "Could not load blog posts." });
  }
});

/** GET /api/blog/sitemap.xml */
router.get("/sitemap.xml", async (req, res) => {
  try {
    const base = clientBaseUrl();
    const rows = await BlogPost.findAll({
      where: { published: true },
      attributes: ["slug", "updatedAt", "publishedAt"],
      order: [["publishedAt", "DESC"]],
    });

    const staticUrls = [
      { loc: `${base}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${base}/blog`, priority: "0.9", changefreq: "daily" },
      { loc: `${base}/privacy`, priority: "0.3", changefreq: "yearly" },
      { loc: `${base}/employment-support`, priority: "0.5", changefreq: "monthly" },
      { loc: `${base}/child-safety`, priority: "0.3", changefreq: "yearly" },
    ];

    const urls = [
      ...staticUrls.map(
        (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
      ),
      ...rows.map((r) => {
        const lastmod = (r.updatedAt || r.publishedAt || new Date()).toISOString().slice(0, 10);
        return `  <url>
    <loc>${base}/blog/${encodeURIComponent(r.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
    res.type("application/xml").send(xml);
  } catch (err) {
    console.error("[blog] sitemap", err.message || err);
    res.status(500).type("text/plain").send("Sitemap unavailable");
  }
});

/** GET /api/blog/admin/all — all posts including drafts */
router.get("/admin/all", verifyToken, requireAdmin, async (req, res) => {
  try {
    const rows = await BlogPost.findAll({
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
      include: [authorInclude],
    });
    res.json(rows.map((r) => serializePost(r)));
  } catch (err) {
    console.error("[blog] admin list", err.message || err);
    res.status(500).json({ error: "Could not load posts." });
  }
});

/** GET /api/blog/:slug — published post (or any if admin? keep public published-only) */
router.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug || slug === "admin" || slug === "sitemap.xml") {
      return res.status(404).json({ error: "Not found" });
    }
    const row = await BlogPost.findOne({
      where: { slug, published: true },
      include: [authorInclude],
    });
    if (!row) return res.status(404).json({ error: "Post not found" });
    res.json(serializePost(row));
  } catch (err) {
    console.error("[blog] get", err.message || err);
    res.status(500).json({ error: "Could not load post." });
  }
});

/** POST /api/blog — create */
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const excerpt = String(req.body.excerpt || "").trim().slice(0, 500);
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required." });
    }

    const slug = await uniqueSlug(req.body.slug || title);
    const published = !!req.body.published;
    const post = await BlogPost.create({
      title,
      slug,
      excerpt: excerpt || body.slice(0, 180),
      body,
      tags: tagsToStore(req.body.tags),
      coverImageUrl: req.body.coverImageUrl ? String(req.body.coverImageUrl).trim() : null,
      seoTitle: req.body.seoTitle ? String(req.body.seoTitle).trim().slice(0, 255) : null,
      seoDescription: req.body.seoDescription
        ? String(req.body.seoDescription).trim().slice(0, 320)
        : null,
      published,
      publishedAt: published ? new Date() : null,
      authorId: req.user.id,
    });

    const withAuthor = await BlogPost.findByPk(post.id, { include: [authorInclude] });
    res.status(201).json(serializePost(withAuthor));
  } catch (err) {
    console.error("[blog] create", err.message || err);
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Slug already in use." });
    }
    res.status(500).json({ error: "Could not create post." });
  }
});

/** PUT /api/blog/:id — update */
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const post = await BlogPost.findByPk(id);
    if (!post) return res.status(404).json({ error: "Not found" });

    const title = req.body.title != null ? String(req.body.title).trim() : post.title;
    const body = req.body.body != null ? String(req.body.body).trim() : post.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required." });
    }

    let slug = post.slug;
    if (req.body.slug != null || (req.body.title != null && req.body.retitleSlug)) {
      slug = await uniqueSlug(req.body.slug || title, post.id);
    }

    const wasPublished = post.published;
    const published = req.body.published != null ? !!req.body.published : post.published;
    let publishedAt = post.publishedAt;
    if (published && !wasPublished) publishedAt = new Date();
    if (!published) publishedAt = null;

    await post.update({
      title,
      slug,
      body,
      excerpt:
        req.body.excerpt != null
          ? String(req.body.excerpt).trim().slice(0, 500)
          : post.excerpt || body.slice(0, 180),
      tags: req.body.tags !== undefined ? tagsToStore(req.body.tags) : post.tags,
      coverImageUrl:
        req.body.coverImageUrl !== undefined
          ? req.body.coverImageUrl
            ? String(req.body.coverImageUrl).trim()
            : null
          : post.coverImageUrl,
      seoTitle:
        req.body.seoTitle !== undefined
          ? req.body.seoTitle
            ? String(req.body.seoTitle).trim().slice(0, 255)
            : null
          : post.seoTitle,
      seoDescription:
        req.body.seoDescription !== undefined
          ? req.body.seoDescription
            ? String(req.body.seoDescription).trim().slice(0, 320)
            : null
          : post.seoDescription,
      published,
      publishedAt,
    });

    const withAuthor = await BlogPost.findByPk(post.id, { include: [authorInclude] });
    res.json(serializePost(withAuthor));
  } catch (err) {
    console.error("[blog] update", err.message || err);
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Slug already in use." });
    }
    res.status(500).json({ error: "Could not update post." });
  }
});

/** DELETE /api/blog/:id */
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const post = await BlogPost.findByPk(id);
    if (!post) return res.status(404).json({ error: "Not found" });
    await post.destroy();
    res.status(204).send();
  } catch (err) {
    console.error("[blog] delete", err.message || err);
    res.status(500).json({ error: "Could not delete post." });
  }
});

module.exports = { blogRouter: router, slugify };
