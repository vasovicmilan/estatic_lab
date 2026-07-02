import pino from "pino";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const transport =
  !isProd && !isTest
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:dd.mm.yyyy HH:MM:ss",
          ignore: "pid,hostname",
        },
      })
    : undefined;

const logger = pino(
  {
    level: isTest ? "silent" : process.env.LOG_LEVEL || "info",
    serializers: {
      err: (err) => ({
        type: err.name,
        message: err.message,
        stack: isProd ? undefined : err.stack,
      }),
    },
  },
  transport
);

logger.on("error", (err) => console.error("Logger stream error:", err));

export default logger;