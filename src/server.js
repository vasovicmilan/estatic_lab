import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import "./events/listeners/email.listener.js";
import "./events/listeners/telegram.listener.js";
import "./events/listeners/commission.listener.js";
import "./events/listeners/google-calendar.listener.js";
import "./events/listeners/analytics.listener.js";
import { initTelegramBot, stopTelegramBot } from "./integrations/telegram/telegram.provider.js";
import { initGoogleCalendarClient } from "./integrations/google-calendar/google-calendar.provider.js";
import { startScheduler } from "./jobs/scheduler.js";
import { loadRuntimeSettings } from "./config/runtime-settings.cache.js";
import { registerMongoConnectionListeners } from "./config/mongo-connection.events.js";
import { logInfo, logError } from "./utils/logger.util.js";
import { alertError } from "./utils/telegram-alert.util.js";

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

    // Wired up right after the initial connect succeeds - see mongo-connection.events.js
    // for why a dropped/errored connection gets its own clearly-labeled Telegram alert
    // instead of surfacing only as a wave of ordinary-looking request 500s.
    registerMongoConnectionListeners();

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

// A rejected promise nobody caught is just as much an unrecoverable-state signal as
// a thrown exception nobody caught (this is Node's own guidance, not just this app's
// opinion - see https://nodejs.org/api/process.html#event-unhandledrejection). Before
// this fix, an unhandled rejection only logged and the process kept running, silently
// drifting into whatever half-broken state produced it, while the equivalent thrown
// exception below (uncaughtException) already correctly treats that as fatal. So this
// now mirrors uncaughtException exactly: log, page Telegram, then exit so the process
// manager (PM2) restarts into a known-good state instead of a corrupted one.
process.on("unhandledRejection", async (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logError("Unhandled promise rejection", error);
  // Awaited (and never allowed to throw past this handler) so the alert has a chance
  // to actually reach Telegram before process.exit(1) tears the process down.
  await alertError(error.message, { source: "unhandledRejection" }).catch(() => {});
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
  process.exit(1);
});

start();