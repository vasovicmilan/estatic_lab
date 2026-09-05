import cors from "cors";
import { BUSINESS } from "./business.config.js";

const isProd = process.env.NODE_ENV === "production";

// Same BASE_URL used everywhere else in the codebase (email.service.js, seo/index.js,
// etc.) - now sourced from business.config.js's siteUrl instead of a locally
// redefined fallback, so CORS never silently diverges from the domain the rest
// of the app assumes it's running on. baseUrlVariants() below still generates
// both www/non-www forms regardless, so this is a source-of-truth cleanup, not
// a behavior change here.
const BASE_URL = BUSINESS.siteUrl;

function baseUrlVariants(url) {
  try {
    const u = new URL(url);
    const withWww = u.hostname.startsWith("www.") ? u.hostname : `www.${u.hostname}`;
    const withoutWww = u.hostname.startsWith("www.") ? u.hostname.slice(4) : u.hostname;
    return [`${u.protocol}//${withWww}`, `${u.protocol}//${withoutWww}`];
  } catch {
    return [url];
  }
}

const allowedOrigins = new Set([
  ...baseUrlVariants(BASE_URL),
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()) : []),
]);

// Only ever widen to localhost outside production - never as a silent prod fallback.
if (!isProd) {
  allowedOrigins.add("http://localhost:3002");
  allowedOrigins.add("http://127.0.0.1:3002");
}

export function setupCors(app) {
  app.use(
    "/api",
    cors({
      origin: (origin, callback) => {
        // no Origin header (server-to-server, curl, same-origin) - allow
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "CSRFToken"],
      maxAge: 86400,
    })
  );
}