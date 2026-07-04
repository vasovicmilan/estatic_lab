import morgan from "morgan";
import { httpLogger } from "./logger.config.js";

export function setupMorgan(app) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  app.use(
    morgan(
      process.env.NODE_ENV === "production"
        ? '[:date[iso]] :method :url :status :res[content-length] - :response-time ms - :remote-addr - ":user-agent"'
        : ":method :url :status :res[content-length] - :response-time ms",
      {
        skip(req) {
          return (
            req.method === "GET" &&
            /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|map)$/.test(
              req.path
            )
          );
        },

        stream: {
          write(message) {
            httpLogger.info(message.trim());
          },
        },
      }
    )
  );
}