import morgan from "morgan";
import { httpLogger } from "./logger.config.js";

// Query params that must never reach the access log verbatim - OAuth
// authorization codes/tokens/state are short-lived secrets, not just noise
// (see auth.controller.js's googleCallback: /prijava/google/callback?code=...
// used to be logged in full via morgan's default :url token). Matched
// case-insensitively so `Code=`, `access_token`, etc. are all caught, not
// just the exact casing Google happens to use today.
const REDACTED_QUERY_PARAMS = ["code", "state", "token", "access_token", "id_token", "refresh_token"];

morgan.token("safe-url", (req) => {
  const [path, query] = req.originalUrl.split("?");
  if (!query) return path;

  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (REDACTED_QUERY_PARAMS.includes(key.toLowerCase())) {
      params.set(key, "REDACTED");
    }
  }
  return `${path}?${params.toString()}`;
});

export function setupMorgan(app) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  app.use(
    morgan(
      process.env.NODE_ENV === "production"
        ? '[:date[iso]] :method :safe-url :status :res[content-length] - :response-time ms - :remote-addr - ":user-agent"'
        : ":method :safe-url :status :res[content-length] - :response-time ms",
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