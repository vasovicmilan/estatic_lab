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

const streams = [];

if (isTest) {
  streams.push({
    stream: pino.destination("/dev/null"),
  });
} else {
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

  streams.push({
    level: "info",
    stream: pino.destination({
      dest: logFile("app"),
      mkdir: true,
      sync: false,
    }),
  });

  streams.push({
    level: "error",
    stream: pino.destination({
      dest: logFile("error"),
      mkdir: true,
      sync: false,
    }),
  });

  streams.push({
    level: "info",
    stream: pino.destination({
      dest: logFile("http"),
      mkdir: true,
      sync: false,
    }),
  });
}

const logger = pino(
  {
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
  },
  pino.multistream(streams)
);

logger.on("error", (err) => {
  console.error("Logger stream error:", err);
});

export const httpLogger = logger.child({
  type: "http",
});

export default logger;