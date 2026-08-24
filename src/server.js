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

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected");

    // Populates the in-memory booking-policy/currency cache from SiteSettings
    // before anything starts serving traffic - see runtime-settings.cache.js.
    // Deliberately awaited (not fire-and-forget): the first request should
    // already see the real configured values, not the fallback defaults.
    await loadRuntimeSettings();

    initTelegramBot();
    initGoogleCalendarClient();
    startScheduler();

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