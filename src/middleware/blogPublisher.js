const crypto = require("crypto");
const { verifyToken } = require("./auth");
const { requireAdmin } = require("./requireAdmin");

/** Compare two strings without leaking which one mismatched. */
function tokensMatch(provided, expected) {
  const left = crypto.createHash("sha256").update(String(provided ?? ""), "utf8").digest();
  const right = crypto.createHash("sha256").update(String(expected ?? ""), "utf8").digest();
  const equal = crypto.timingSafeEqual(left, right);
  return equal && String(expected || "").length > 0 && String(provided || "").length > 0;
}

/**
 * Accept the automation token, or a logged-in admin.
 * The token is checked only here, so it cannot open any other route.
 */
function blogPublisherAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const expected = process.env.BLOG_PUBLISH_TOKEN || "";
  if (provided && tokensMatch(provided, expected)) {
    req.blogPublisher = true;
    return next();
  }
  return verifyToken(req, res, () => requireAdmin(req, res, next));
}

module.exports = { blogPublisherAuth, tokensMatch };
