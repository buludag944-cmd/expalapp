const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");
const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "No token provided" });
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // adds user info to request
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
module.exports = { verifyToken };
