/**
 * PM2 entry for Next.js with `output: "standalone"`.
 * Uses `node .next/standalone/server.js` (required; `next start` is not supported for standalone).
 * Copies `public` and `.next/static` into the standalone output on each start (Next.js requirement).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const buildId = path.join(root, ".next", "BUILD_ID");
const standaloneDir = path.join(root, ".next", "standalone");
const serverJs = path.join(standaloneDir, "server.js");

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

if (!fs.existsSync(serverJs)) {
  console.error(
    "[fitcheck] Missing .next/standalone/server.js. Your next.config must use output: \"standalone\" " +
    "and you must run npm run build.\n"
  );
  process.exit(1);
}

function syncStandaloneAssets() {
  const pubSrc = path.join(root, "public");
  const pubDest = path.join(standaloneDir, "public");
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");

  if (fs.existsSync(pubSrc)) {
    fs.cpSync(pubSrc, pubDest, { recursive: true, force: true });
  }
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
  }
}

syncStandaloneAssets();

const child = spawn(process.execPath, [serverJs], {
  cwd: standaloneDir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
