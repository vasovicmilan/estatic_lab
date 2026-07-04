import helmet from "helmet";

function isLocalHost(hostname) {
  if (!hostname) return true;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.")
  );
}

function isHTTPS(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setupHelmet(app) {
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" },
      frameguard: { action: "sameorigin" },
      hidePoweredBy: true,
      noSniff: true,
    })
  );

  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api")) return next();

    const https = isHTTPS(req);
    const local = isLocalHost(req.hostname);

    const csp = {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://accounts.google.com/gsi/client"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      "font-src": ["'self'", "https://cdn.jsdelivr.net", "data:"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'", "https://accounts.google.com"],
      "base-uri": ["'self'"],
      "frame-src": ["'self'", "https://accounts.google.com"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'self'"],
      "form-action": ["'self'"],
    };

    if (https && !local && process.env.NODE_ENV === "production") {
      csp["upgrade-insecure-requests"] = [];
    }

    const cspString = Object.entries(csp)
      .map(([key, values]) => (values.length === 0 ? "" : `${key} ${values.join(" ")};`))
      .filter(Boolean)
      .join(" ");

    res.setHeader("Content-Security-Policy", cspString);
    next();
  });

  app.use((req, res, next) => {
    const https = isHTTPS(req);
    const local = isLocalHost(req.hostname);

    if (!local && https && process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });
}