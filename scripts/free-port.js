#!/usr/bin/env node
/**
 * Free a TCP port before starting the API (avoids CRA or stale node on :3001).
 * Usage: node scripts/free-port.js [port]
 * Respects PORT env; default 3001.
 */
const { execSync } = require("child_process");

const port = String(process.argv[2] || process.env.PORT || "3001").trim();

try {
  const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
  if (!pids) {
    console.log(`[port] Port ${port} is free`);
    process.exit(0);
  }
  const list = pids.split(/\s+/).filter(Boolean);
  console.log(`[port] Stopping process(es) on port ${port}: ${list.join(", ")}`);
  execSync(`kill -9 ${list.join(" ")}`, { stdio: "inherit" });
  console.log(`[port] Port ${port} cleared`);
} catch (err) {
  if (err.status === 1) {
    console.log(`[port] Port ${port} is free`);
  } else {
    console.warn(`[port] Could not inspect port ${port}:`, err.message || err);
    console.warn(
      `[port] If the backend fails to bind, stop the other process manually: lsof -ti:${port} | xargs kill -9`
    );
  }
}
