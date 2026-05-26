#!/usr/bin/env node
/**
 * One command: free :3001, ensure .env.local, start API + CRA.
 * Usage: npm run dev:all   (from backend/)
 */
const { spawn } = require("child_process");
const path = require("path");

const backendRoot = path.join(__dirname, "..");
const frontendRoot = path.join(backendRoot, "..", "frontend");

require("./ensure-env-local");
require("./free-port");

function run(cmd, args, cwd, label) {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", env: process.env });
  child.on("exit", (code) => {
    if (code !== 0 && code != null) console.error(`[dev:all] ${label} exited`, code);
  });
  return child;
}

console.log("[dev:all] Starting backend on :3001 and frontend on :3000…\n");

const api = run("npx", ["nodemon", "src/server.js"], backendRoot, "backend");
setTimeout(() => {
  run("npx", ["react-scripts", "start"], frontendRoot, "frontend");
}, 2500);

process.on("SIGINT", () => {
  api.kill("SIGTERM");
  process.exit(0);
});
