import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import "./events/listeners/email.listener.js";
import "./events/listeners/telegram.listener.js";
import "./events/listeners/commission.listener.js";
import "./events/listeners/google-calendar.listener.js";
import { initTelegramBot, stopTelegramBot } from "./integrations/telegram/telegram.provider.js";
import { initGoogleCalendarClient } from "./integrations/google-calendar/google-calendar.provider.js";
import { startScheduler } from "./jobs/scheduler.js";
import { loadRuntimeSettings } from "./config/runtime-settings.cache.js";
import { logInfo, logError } from "./utils/logger.util.js";

const PORT = process.env.PORT || 3000;

// In PM2 cluster mode, every worker imports and runs this same file - without
// this guard, N workers means N independent cron schedulers and N Telegram
// bot pollers fighting over the same bot token (Telegram's API rejects
// concurrent getUpdates from the same token with a 409). In fork mode
// (single instance), NODE_APP_INSTANCE is unset, so this still evaluates to
// true and behaves exactly as before - no change for non-cluster deployments.
const isSingletonWorker = (process.env.NODE_APP_INSTANCE || "0") === "0";

async function start() {
  try {
    // maxPoolSize is opt-in via env, not hardcoded here - each PM2 cluster
    // worker gets its own independent connection pool (Mongoose default is
    // 100 per pool if unset), so N workers x default pool can quietly exceed
    // a shared MongoDB tier's total connection limit under concurrent load.
    // Left unset in normal single-instance deployments (keeps existing
    // behavior); set MONGO_MAX_POOL_SIZE explicitly when running clustered
    // against a connection-limited tier (e.g. Atlas M0) - see load testing notes.
    const mongoOptions = process.env.MONGO_MAX_POOL_SIZE
      ? { maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) }
      : undefined;
    await mongoose.connect(process.env.MONGO_URI, mongoOptions);
    logInfo("MongoDB connected");

    // Populates the in-memory booking-policy/currency cache from SiteSettings
    // before anything starts serving traffic - see runtime-settings.cache.js.
    // Deliberately awaited (not fire-and-forget): the first request should
    // already see the real configured values, not the fallback defaults.
    await loadRuntimeSettings();

    if (isSingletonWorker) {
      initTelegramBot();
      startScheduler();
    }
    initGoogleCalendarClient();

    const server = app.listen(PORT, "0.0.0.0", () => {
      logInfo(`Server running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      logInfo(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await stopTelegramBot();
        await mongoose.connection.close();
        logInfo("Shutdown complete");
        process.exit(0);
      });
      // force-exit if graceful shutdown hangs
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logError("Failed to start server", error);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logError("Unhandled promise rejection", reason instanceof Error ? reason : new Error(String(reason)));
});

process.on("uncaughtException", (error) => {  
  logError("Uncaught exception", error);
  process.exit(1);
});

start();