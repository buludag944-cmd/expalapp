#!/usr/bin/env node
/** Creates .env.local from example if missing — you only edit SMTP_USER + SMTP_PASS once. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const local = path.join(root, ".env.local");
const example = path.join(root, ".env.local.example");

if (!fs.existsSync(local) && fs.existsSync(example)) {
  fs.copyFileSync(example, local);
  console.log("[setup] Created backend/.env.local — add SMTP_USER and SMTP_PASS, then restart.");
}

const merged = fs.existsSync(local) ? fs.readFileSync(local, "utf8") : "";
const pass = ((merged.match(/^SMTP_PASS=(.*)$/m) || [])[1] || "").trim();
const user = ((merged.match(/^SMTP_USER=(.*)$/m) || [])[1] || "").trim();

const placeholder =
  !pass ||
  /your-app-password|xxxx/i.test(pass) ||
  !user ||
  /@example\.com$/i.test(user);

if (placeholder) {
  console.warn(
    "[setup] Optional: add Gmail to backend/.env.local (SMTP_USER + SMTP_PASS) for real verification emails."
  );
  console.warn("[setup] App runs without it — signup/resend work except inbox delivery.");
} else {
  console.log("[setup] SMTP ready for", user);
}
