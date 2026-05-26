#!/usr/bin/env node
/**
 * Validates SMTP config, /health, and POST /api/auth/resend-verification wiring.
 * Usage: node scripts/verify-smtp-resend.js [email]
 * Requires: backend/.env with real SMTP_* and server on PORT (default 3001).
 */
require("../src/config/loadEnv");

const http = require("http");

const port = Number(process.env.PORT) || 3001;
const testEmail = process.argv[2] || "resend-check@example.com";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers: { "Content-Type": "application/json" } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            json = {};
          }
          resolve({ status: res.statusCode, body: raw, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function hint(line) {
  console.log(`  → ${line}`);
}

async function main() {
  console.log("\n=== SMTP & resend verification ===\n");

  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) {
    console.error("FAIL: SMTP_HOST missing in backend/.env");
    hint("cp .env.example .env and set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM");
    process.exit(1);
  }
  console.log(`SMTP_HOST=${host} SMTP_PORT=${process.env.SMTP_PORT || 587} SMTP_SECURE=${process.env.SMTP_SECURE || "false"}`);

  let health;
  try {
    health = await request("GET", "/health");
  } catch (e) {
    console.error("FAIL: Cannot reach backend on port", port);
    hint("cd backend && npm start");
    hint(`curl http://localhost:${port}/health`);
    process.exit(1);
  }

  if (health.status !== 200 || !health.body.includes('"ok":true')) {
    console.error("FAIL: /health expected 200 {\"ok\":true}, got", health.status, health.body);
    process.exit(1);
  }
  console.log("PASS: GET /health →", health.body.trim());

  const resend = await request("POST", "/api/auth/resend-verification", { email: testEmail });
  console.log("POST /api/auth/resend-verification →", resend.status, resend.body);

  if (resend.status === 503 && /not configured|SMTP/i.test(resend.json.error || "")) {
    console.error("FAIL: SMTP not configured on running server");
    hint("Restart backend after editing backend/.env");
    process.exit(1);
  }

  if (resend.status === 200) {
    console.log("PASS: Resend route reachable (200). Check backend logs for [resend] and [email] SMTP accepted message");
    if (/resent|verification link/i.test(resend.json.message || "")) {
      hint("If inbox is empty but logs show SMTP accepted, check Spam and MAIL_FROM with your provider");
    }
    process.exit(0);
  }

  if (resend.status === 503) {
    console.error("FAIL: SMTP send failed — fix credentials in .env and restart");
    process.exit(1);
  }

  console.log("INFO: Status", resend.status, "— inspect backend terminal for [resend] logs");
  process.exit(resend.status >= 400 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
