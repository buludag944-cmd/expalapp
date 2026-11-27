const http = require("http");
const path = require("path");

process.env.DATABASE_PATH = path.join(__dirname, "blog-publish-test.db");
delete process.env.DATABASE_URL;
process.env.BLOG_PUBLISH_TOKEN = "correct-token-0123456789abcdef";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.BLOG_PUBLISH_MAX = "30";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const sequelize = require("../src/config/database");
const { User, BlogPost } = require("../src/bootstrapModels");
const { blogRouter } = require("../src/routes/blog");
const { resetBlogPublishLimit } = require("../src/lib/blogPublishLimit");
const express = require("express");

const TOKEN = process.env.BLOG_PUBLISH_TOKEN;

function request(server, { method, urlPath, token, body }) {
  const { port } = server.address();
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let server;

before(async () => {
  await User.sync({ force: true });
  await BlogPost.sync({ force: true });
  const app = express();
  app.use(express.json());
  app.use("/api/blog", blogRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  fs.rmSync(process.env.DATABASE_PATH, { force: true });
});

test("rejects a request with no token", async () => {
  resetBlogPublishLimit();
  const res = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/no-token",
    body: { title: "Hello", content: "Body text" },
  });
  assert.equal(res.status, 401);
});

test("rejects a wrong token", async () => {
  resetBlogPublishLimit();
  const res = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/wrong-token",
    token: "not-the-token",
    body: { title: "Hello", content: "Body text" },
  });
  assert.equal(res.status, 401);
});

test("creates a post with a valid token", async () => {
  resetBlogPublishLimit();
  const res = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/first-post",
    token: TOKEN,
    body: {
      title: "First post",
      slug: "first-post",
      excerpt: "A short excerpt",
      content: "The full article.",
      tags: ["ireland"],
      seoTitle: "First post SEO",
      seoDescription: "A description",
      published: true,
      author: "EXPal editorial",
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.slug, "first-post");
  assert.equal(res.json.body, "The full article.");
  assert.equal(res.json.published, true);
  assert.equal(res.json.author.firstName, "EXPal");
});

test("updates the same slug instead of creating a second post", async () => {
  resetBlogPublishLimit();
  const res = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/first-post",
    token: TOKEN,
    body: {
      title: "First post revised",
      slug: "first-post",
      content: "Updated article.",
      published: true,
      author: "EXPal editorial",
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.title, "First post revised");
  assert.equal(res.json.body, "Updated article.");
  const count = await BlogPost.count({ where: { slug: "first-post" } });
  assert.equal(count, 1);
});

test("returns a slug collision when the body slug belongs to another post", async () => {
  resetBlogPublishLimit();
  const created = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/second-post",
    token: TOKEN,
    body: { title: "Second", slug: "second-post", content: "Other article.", published: true },
  });
  assert.equal(created.status, 201);

  const clash = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/brand-new-slug",
    token: TOKEN,
    body: { title: "Clash", slug: "first-post", content: "Should not overwrite.", published: true },
  });
  assert.equal(clash.status, 409);
  const untouched = await BlogPost.findOne({ where: { slug: "first-post" } });
  assert.equal(untouched.title, "First post revised");
});

test("rate-limits publishes after the hourly cap", async () => {
  resetBlogPublishLimit();
  process.env.BLOG_PUBLISH_MAX = "2";
  const body = { title: "Limited", content: "Text", published: false };
  const first = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/limited-post",
    token: TOKEN,
    body,
  });
  const second = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/limited-post",
    token: TOKEN,
    body,
  });
  const third = await request(server, {
    method: "PUT",
    urlPath: "/api/blog/by-slug/limited-post",
    token: TOKEN,
    body,
  });
  process.env.BLOG_PUBLISH_MAX = "30";
  resetBlogPublishLimit();
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
});

test("the publish token cannot read the admin post list", async () => {
  resetBlogPublishLimit();
  const res = await request(server, {
    method: "GET",
    urlPath: "/api/blog/admin/all",
    token: TOKEN,
  });
  assert.equal(res.status, 401);
});
