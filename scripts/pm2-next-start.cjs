/**
 * PM2 entry: fail fast with a clear message if `next build` was not run.
 * Keeps cwd aligned with the app root (same folder as `.next`).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const buildId = path.join(root, ".next", "BUILD_ID");

if (!fs.existsSync(buildId)) {
  console.error(
    "[fitcheck] No production build in .next/. Run from the project root:\n" +
    "  npm ci\n" +
    "  npm run build\n" +
    "  pm2 start ecosystem.config.cjs\n" +
    "Or use: npm run pm2:start (builds then starts PM2).\n"
  );
  process.exit(1);
}

const nextBin = require.resolve("next/dist/bin/next", { paths: [root] });
const child = spawn(process.execPath, [nextBin, "start"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
