const path = require("path");

/**
 * PM2 process file — production on a VPS or bare metal.
 *
 * Requires a production build (`.next/` with BUILD_ID). `.next` is gitignored;
 * on the server run `npm run build` after deploy, or use `npm run pm2:start`.
 *
 * Usage:
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Loads variables from `.env` in the project root (PM2 5.2+).
 * Override PORT or paths via shell env when starting if needed.
 */
module.exports = {
  apps: [
    {
      name: "fitcheck",
      cwd: __dirname,
      script: path.join(__dirname, "scripts/pm2-next-start.cjs"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
