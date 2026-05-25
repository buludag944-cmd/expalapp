const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const backendRoot = path.join(__dirname, "..", "..");

dotenv.config({ path: path.join(backendRoot, ".env") });

const localPath = path.join(backendRoot, ".env.local");
if (fs.existsSync(localPath)) {
  dotenv.config({ path: localPath, override: true });
}

// Auto sender when only SMTP_USER is set in .env.local
const smtpUser = (process.env.SMTP_USER || "").trim();
const mailFrom = (process.env.MAIL_FROM || "").trim();
if (smtpUser && (!mailFrom || /yourdomain|no-reply@yourdomain/i.test(mailFrom))) {
  process.env.MAIL_FROM = `"Expat App" <${smtpUser}>`;
}

module.exports = { backendRoot, localPath };
