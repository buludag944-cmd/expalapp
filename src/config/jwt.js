const jwt = require("jsonwebtoken");

/** Keep middleware/auth.js and this module on the same secret (override via JWT_SECRET in prod). */
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function issueAuthTokenPayload(user) {
  const isAdmin = !!user.isAdmin;
  const token = jwt.sign(
    { id: user.id, email: user.email, isAdmin },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  return {
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin,
    },
  };
}

module.exports = { JWT_SECRET, issueAuthTokenPayload };
