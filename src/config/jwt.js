const jwt = require("jsonwebtoken");
const { serializeUserProfile } = require("../lib/userProfile");

/** Keep middleware/auth.js and this module on the same secret (override via JWT_SECRET in prod). */
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function issueAuthTokenPayload(user) {
  const isAdmin = !!user.isAdmin;
  const token = jwt.sign(
    { id: user.id, email: user.email, isAdmin },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  return {
    token,
    user: serializeUserProfile(user),
  };
}

module.exports = { JWT_SECRET, issueAuthTokenPayload };
