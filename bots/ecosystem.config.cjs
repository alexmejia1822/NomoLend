/// PM2 Ecosystem Configuration for NomoLend Keeper Bots
/// Each bot runs as an independent process for maximum resilience
///
/// Usage:
///   pm2 start bots/ecosystem.config.cjs
///   pm2 status
///   pm2 logs
///   pm2 restart all
///   pm2 stop all

const path = require("path");
const PROJECT_ROOT = path.resolve(__dirname, "..");

const COMMON = {
  cwd: PROJECT_ROOT,
  exec_mode: "fork",
  autorestart: true,
  max_restarts: 50,
  min_uptime: "10s",
  restart_delay: 5000,
  max_memory_restart: "256M",
  merge_logs: true,
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  env: {
    NODE_ENV: "production",
  },
};

module.exports = {
  apps: [
    {
      ...COMMON,
      name: "nomolend-price-updater",
      script: "bots/priceUpdater.js",
      error_file: "logs/price-updater-error.log",
      out_file: "logs/price-updater-out.log",
    },
    {
      ...COMMON,
      name: "nomolend-liquidation-bot",
      script: "bots/liquidationBot.js",
      error_file: "logs/liquidation-bot-error.log",
      out_file: "logs/liquidation-bot-out.log",
    },
    {
      ...COMMON,
      name: "nomolend-monitor-bot",
      script: "bots/monitorBot.js",
      error_file: "logs/monitor-bot-error.log",
      out_file: "logs/monitor-bot-out.log",
    },
    {
      ...COMMON,
      name: "nomolend-health-api",
      script: "bots/healthServer.js",
      max_restarts: 20,
      restart_delay: 3000,
      max_memory_restart: "128M",
      error_file: "logs/health-api-error.log",
      out_file: "logs/health-api-out.log",
    },
  ],
};
