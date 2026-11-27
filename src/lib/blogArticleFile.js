/**
 * A blog file is markdown with a short header:
 *
 * ---
 * title: How to get a PPS number
 * slug: how-to-get-a-pps-number
 * excerpt: A short summary
 * tags: pps, ireland
 * published: true
 * ---
 *
 * The article itself starts after the second ---.
 */

function parseBlogArticle(markdown) {
  const text = String(markdown || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    throw new Error("Article must start with a --- header.");
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error("Article header is missing the closing ---.");
  }
  const header = text.slice(4, end);
  const content = text.slice(end + 5).trim();
  const fields = {};
  for (const line of header.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const splitAt = trimmed.indexOf(":");
    if (splitAt === -1) throw new Error(`Header line needs a colon: ${trimmed}`);
    const key = trimmed.slice(0, splitAt).trim();
    const value = trimmed.slice(splitAt + 1).trim();
    fields[key] = value;
  }

  const title = fields.title || "";
  const slug = fields.slug || "";
  if (!title) throw new Error("Header needs a title.");
  if (!slug) throw new Error("Header needs a slug.");
  if (!content) throw new Error("Article body is empty.");

  const tags = (fields.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    title,
    slug,
    excerpt: fields.excerpt || "",
    tags,
    seoTitle: fields.seoTitle || "",
    seoDescription: fields.seoDescription || "",
    published: fields.published == null || fields.published === "" ? true : fields.published !== "false",
    content,
  };
}

module.exports = { parseBlogArticle };
