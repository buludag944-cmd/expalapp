#!/usr/bin/env node
/**
 * E2E: start server → register (SMTP) → verify token from DB → expiry/resend → login.
 * Usage: node scripts/e2e-email-verify-flow.js
 * Requires: sqlite3 CLI, writable expal.db, free port 3001, SMTP_* in backend/.env (see .env.example).
 */
require("../src/config/loadEnv");

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, execSync } = require("child_process");

process.on("unhandledRejection", (r) => {
  console.error("[E2E] UNHANDLED REJECTION:", r);
});

const ROOT = path.resolve(__dirname, "..");
const DB = path.join(ROOT, "expal.db");
const LOG_PATH = path.join(ROOT, ".e2e-email-verify.log");

function curlJson(method, pathname, body) {
  const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    /** @type {http.RequestOptions & { pathname: string }} */
    const opts = {
      hostname: "127.0.0.1",
      port: 3001,
      path: pathname,
      method,
      headers: {},
    };
    if (payload) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = String(payload.length);
    }
    const req = http.request(opts, (res) => {
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
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function killListen3001() {
  try {
    execSync(`lsof -ti:3001 | xargs kill -9 2>/dev/null`, {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    /* no listener */
  }
}

function waitFor(predicate, opts = {}) {
  const timeout = opts.timeoutMs ?? 45000;
  const interval = opts.intervalMs ?? 150;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (predicate()) return resolve();
        if (Date.now() - start > timeout) {
          return reject(new Error(opts.timeoutMsg || "waitFor timeout"));
        }
        setTimeout(tick, interval);
      } catch (e) {
        reject(e);
      }
    };
    tick();
  });
}

function readLog() {
  try {
    return fs.readFileSync(LOG_PATH, "utf8");
  } catch {
    return "";
  }
}

function sqliteQuery(sql) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function expireVerifyToken(email) {
  sqliteQuery(
    `UPDATE Users SET verifyTokenExpiresAt = datetime('now', '-25 hours') WHERE lower(email)=lower('${email.replace(/'/g, "''")}');`
  );
}

function readVerifyTokenFromDb(email) {
  const row = sqliteQuery(
    `SELECT verifyToken FROM Users WHERE lower(email)=lower('${email.replace(/'/g, "''")}') LIMIT 1;`
  );
  return row || null;
}

async function main() {
  if (!(process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim())) {
    console.error("[E2E] SMTP_HOST is not set. Copy backend/.env.example to backend/.env and configure SMTP.");
    process.exit(1);
  }

  const email = "autoverify@example.com";
  const password = "StrongPassword123!";

  fs.writeFileSync(LOG_PATH, "");

  killListen3001();
  try {
    execSync(`sqlite3 "${DB}" ${JSON.stringify(`DELETE FROM Users WHERE lower(email)=lower('${email}');`)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    console.warn("[E2E] sqlite cleanup:", e.message);
  }

  const env = { ...process.env, PORT: "3001" };

  const child = spawn("node", ["src/server.js"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let combined = "";
  const pipe = (d) => {
    const s = d.toString();
    combined += s;
    process.stdout.write(s);
    fs.appendFileSync(LOG_PATH, s);
  };
  child.stdout.on("data", pipe);
  child.stderr.on("data", pipe);
  child.on("error", (e) => {
    console.error("[E2E] spawn error:", e);
    process.exit(1);
  });

  const shutdown = async () =>
    new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    });

  try {
    await waitFor(
      () => combined.includes("Server listening") || readLog().includes("Server listening"),
      { timeoutMs: 45000, timeoutMsg: "Server did not log Server listening", intervalMs: 100 }
    );
    console.log("\n[E2E] Server listening — proceed.\n");

    const reg = await curlJson("POST", "/api/register", {
      firstName: "Auto",
      lastName: "Verify",
      email,
      password,
    });
    if (reg.status !== 201) {
      throw new Error(`Register expected 201 got ${reg.status}: ${reg.body}`);
    }
    console.log("[E2E] POST /api/register →", reg.status);

    await waitFor(
      () => {
        const L = readLog();
        return (
          /\[email\] SMTP accepted message/.test(L) || /\[email\] sendMail failed:/.test(L)
        );
      },
      { timeoutMs: 60000, timeoutMsg: "No SMTP send result in logs", intervalMs: 100 }
    );

    const afterRegister = readLog();
    if (afterRegister.includes("[email] sendMail failed:")) {
      throw new Error("SMTP send failed during register — check backend/.env credentials");
    }
    if (!afterRegister.includes("[email] SMTP accepted message")) {
      throw new Error("Missing [email] SMTP accepted message after register");
    }

    const token = readVerifyTokenFromDb(email);
    if (!token || token.length !== 64) {
      throw new Error(`No verifyToken in DB after register (got: ${token})`);
    }
    console.log("[E2E] verifyToken from DB, length", token.length);

    const preLogin = await curlJson("POST", "/api/login", { email, password });
    if (preLogin.status !== 403) {
      throw new Error(`Expected 403 before verify, got ${preLogin.status}: ${preLogin.body}`);
    }
    console.log("[E2E] Pre-verify login →", preLogin.status, preLogin.json.error);

    expireVerifyToken(email);
    const expiredVerify = await curlJson("GET", `/api/auth/verify/${encodeURIComponent(token)}`, null);
    if (expiredVerify.status !== 400) {
      throw new Error(`Expected 400 for expired token, got ${expiredVerify.status}: ${expiredVerify.body}`);
    }
    if (!String(expiredVerify.json.error || "").includes("expired")) {
      throw new Error(`Expected expired error, got: ${expiredVerify.body}`);
    }
    console.log("[E2E] Expired token verify →", expiredVerify.status, expiredVerify.json.error);

    const resend = await curlJson("POST", "/api/auth/resend-verification", { email });
    if (resend.status !== 200) {
      throw new Error(`Resend expected 200 got ${resend.status}: ${resend.body}`);
    }
    console.log("[E2E] POST /api/auth/resend-verification →", resend.status, resend.json.message);

    await waitFor(
      () => readLog().includes("[resend]") && readLog().includes("reason=resent"),
      { timeoutMs: 15000, timeoutMsg: "No [resend] log after resend", intervalMs: 100 }
    );

    const newToken = readVerifyTokenFromDb(email);
    if (!newToken || newToken.length !== 64) {
      throw new Error(`Resend did not persist a new verifyToken (got: ${newToken})`);
    }
    console.log("[E2E] New verifyToken from DB, length", newToken.length);

    const verifyRes = await curlJson("GET", `/api/auth/verify/${encodeURIComponent(newToken)}`, null);
    if (verifyRes.status !== 200) {
      throw new Error(`Verify expected 200 got ${verifyRes.status}: ${verifyRes.body}`);
    }
    console.log("[E2E] GET /api/auth/verify (after resend) →", verifyRes.status, verifyRes.json.message);

    const logAfterVerify = readLog();
    if (!/\[verify\] Account activated email=/.test(logAfterVerify)) {
      throw new Error("Missing [verify] Account activated log line");
    }
    console.log("[E2E] Backend log contains [verify] Account activated …");

    const okLogin = await curlJson("POST", "/api/login", { email, password });
    if (okLogin.status !== 200 || !okLogin.json.token) {
      throw new Error(`Login expected 200 + token, got ${okLogin.status}: ${okLogin.body}`);
    }
    console.log("[E2E] POST /api/login → 200, JWT present (len", String(okLogin.json.token).length, ")");

    console.log("\n[E2E] PASS — expiry, resend, activation, and login OK.\n");
  } catch (err) {
    console.error("\n[E2E] FAIL:", err.message);
    await shutdown();
    process.exit(1);
  }

  await shutdown();
  process.exit(0);
}

main();
