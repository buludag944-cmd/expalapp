const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseBlogArticle, isArticleDue } = require("../src/lib/blogArticleFile");

test("reads the header and the article body", () => {
  const article = parseBlogArticle(`---
title: How to get a PPS number
slug: how-to-get-a-pps-number
excerpt: The short version
tags: pps, ireland
seoTitle: PPS number in Ireland
seoDescription: Where the official steps are
published: true
---

Ask the Department of Social Protection.

See https://www.gov.ie/
`);
  assert.equal(article.title, "How to get a PPS number");
  assert.equal(article.slug, "how-to-get-a-pps-number");
  assert.deepEqual(article.tags, ["pps", "ireland"]);
  assert.equal(article.published, true);
  assert.match(article.content, /Department of Social Protection/);
});

test("treats a missing published flag as live", () => {
  const article = parseBlogArticle(`---
title: A note
slug: a-note
---

Body text.
`);
  assert.equal(article.published, true);
});

test("reads a bracketed tag list and a future publish date", () => {
  const article = parseBlogArticle(`---
title: Irish immigration stamps explained
slug: irish-immigration-stamps-explained
tags: [stamps, immigration, ireland]
publishDate: 2026-12-07
---

Stamp 1 is a work permission.
`);
  assert.deepEqual(article.tags, ["stamps", "immigration", "ireland"]);
  assert.equal(article.publishDate, "2026-12-07");
  assert.equal(isArticleDue(article, "2026-11-27"), false);
  assert.equal(isArticleDue(article, "2026-12-07"), true);
});

test("keeps published false when the header says so", () => {
  const article = parseBlogArticle(`---
title: A draft
slug: a-draft
published: false
---

Not ready.
`);
  assert.equal(article.published, false);
});
