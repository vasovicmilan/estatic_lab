import pino from "pino";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const LOGS_DIR = path.join(__dirname, "..", "..", "logs");

const logFile = (name) =>
  path.join(LOGS_DIR, isProd ? `${name}.log` : `${name}-dev.log`);

const ROTATE_OPTIONS = {
  frequency: "daily",
  dateFormat: "yyyy-MM-dd",
  mkdir: true,
  limit: { count: 30 }, // keep 30 rotated days + the active file
};

const rollTransport = (name) =>
  pino.transport({
    target: "pino-roll",
    options: { file: logFile(name).replace(/\.log$/, ""), ...ROTATE_OPTIONS },
  });

// Shared options for both pino instances below - identical formatting/
// serializers, just different destinations. Previously this was ONE pino
// instance with a multistream ([app, error, http], all "info"-level) and
// httpLogger was merely `logger.child({type:"http"})` - a child logger still
// writes through the SAME underlying multistream as its parent, so every
// message (whichever logger emitted it) landed in every "info"-level stream.
// That's why app.<date>.log and http.<date>.log were byte-identical: neither
// stream was ever actually http-only or app-only, both just meant "info".
const baseOptions = {
  level: isTest ? "silent" : process.env.LOG_LEVEL || "info",

  timestamp: pino.stdTimeFunctions.isoTime,

  formatters: {
    level(label) {
      return { level: label };
    },

    bindings(bindings) {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        env: process.env.NODE_ENV || "development",
      };
    },
  },

  serializers: {
    err(err) {
      return {
        type: err.name,
        message: err.message,
        stack: isProd ? undefined : err.stack,
      };
    },
  },
};

function buildAppStreams() {
  const streams = [];

  if (isTest) {
    return [{ stream: pino.destination("/dev/null") }];
  }

  if (!isProd) {
    try {
      streams.push({
        level: "info",
        stream: pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:dd.mm.yyyy HH:MM:ss",
            ignore: "pid,hostname",
          },
        }),
      });
    } catch {

    }
  }

  streams.push({ level: "info", stream: rollTransport("app") });
  streams.push({ level: "error", stream: rollTransport("error") });

  return streams;
}

const logger = pino(baseOptions, pino.multistream(buildAppStreams()));

logger.on("error", (err) => {
  console.error("Logger stream error:", err);
});

// A genuinely separate pino instance (own destination), not a .child() of
// `logger` - this is what actually makes http.<date>.log contain only
// request-access lines, distinct from app.<date>.log's cron/lifecycle/
// business-event noise. Errors below "error" level still don't reach
// error.log (this instance has no error stream), matching the previous
// behavior for http-sourced errors.
function buildHttpStreams() {
  if (isTest) return [{ stream: pino.destination("/dev/null") }];

  const streams = [{ level: "info", stream: rollTransport("http") }];
  if (!isProd) {
    try {
      streams.push({
        level: "info",
        stream: pino.transport({
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:dd.mm.yyyy HH:MM:ss", ignore: "pid,hostname" },
        }),
      });
    } catch {

    }
  }
  return streams;
}

const httpStreams = buildHttpStreams();

export const httpLogger = pino(baseOptions, pino.multistream(httpStreams));

httpLogger.on("error", (err) => {
  console.error("HTTP logger stream error:", err);
});

export default logger;