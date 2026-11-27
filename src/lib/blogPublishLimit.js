const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();

function publishLimit() {
  const configured = Number(process.env.BLOG_PUBLISH_MAX);
  return Number.isFinite(configured) && configured > 0 ? configured : 30;
}

function allowBlogPublish(key, now = Date.now()) {
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(key) || []).filter((stamp) => stamp > windowStart);
  if (recent.length >= publishLimit()) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function blogPublishLimiter(req, res, next) {
  const key = req.ip || "unknown";
  if (!allowBlogPublish(key)) {
    return res.status(429).json({ error: "Too many blog publishes. Try again in an hour." });
  }
  return next();
}

function resetBlogPublishLimit() {
  hits.clear();
}

module.exports = { allowBlogPublish, blogPublishLimiter, resetBlogPublishLimit, publishLimit };
