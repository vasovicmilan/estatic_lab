import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import "./events/listeners/email.listener.js";
import "./events/listeners/telegram.listener.js";
import { initTelegramBot, stopTelegramBot } from "./integrations/telegram/telegram.provider.js";
import { startScheduler } from "./jobs/scheduler.js";
import { logInfo, logError } from "./utils/logger.util.js";

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected");

    initTelegramBot();
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