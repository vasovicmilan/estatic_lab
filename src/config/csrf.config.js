import { csrfSync } from "csrf-sync";
import { isLikelyBot } from "../utils/bot-detection.util.js";

export const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) =>
    req.body?.CSRFToken ||
    req.body?._csrf ||
    req.query?.CSRFToken ||
    req.get("x-csrf-token") ||
    req.get("CSRF-Token") ||
    req.get("X-CSRF-Token"),
});

// Anonymous, session-less JSON endpoints that visitors hit from QR codes, often inside in-app
// browsers (Instagram, Facebook, camera apps) that drop or isolate the session cookie - every
// spin from such a phone failed with CsrfError 403 before it even reached validation.
// Nothing here acts on a logged-in user's behalf: the spin is guarded by the honeypot, a rate
// limiter and one-spin-per-contact. A cross-site page cannot send application/json without a
// CORS preflight, so requiring that content type keeps it out of reach of forged form posts.
const CSRF_EXEMPT_JSON_PATHS = new Set(["/tocak/vrti"]);

export function isCsrfExemptJsonRequest(req) {
  const path = (req.originalUrl || "").split("?")[0];
  if (!CSRF_EXEMPT_JSON_PATHS.has(path)) return false;
  return (req.headers?.["content-type"] || "").toLowerCase().startsWith("application/json");
}

export function csrfWebProtection(req, res, next) {
  if (req.originalUrl.startsWith("/api")) return next();
  if (isCsrfExemptJsonRequest(req)) return next();

  const method = req.method?.toUpperCase();
  const needsProtection = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!needsProtection) return next();

  const contentType = req.headers["content-type"] || "";
  if (contentType.toLowerCase().startsWith("multipart/")) {
    return next();
  }

  return csrfSynchronisedProtection(req, res, next);
}

export function csrfLocals(req, res, next) {
  if (req.originalUrl.startsWith("/api")) return next();
  if (!req.session) return next();

  // Recognized bots never submit forms, so they never need a real token -
  // skip touching the session at all for them, rather than generating and
  // persisting one that will just sit unused until its TTL expires. This is
  // purely a hygiene measure (sessions collection stops filling with crawler
  // noise); it changes nothing for real visitors, and a bot that spoofs its
  // User-Agent to dodge this simply falls back to the exact behavior every
  // visitor already gets today.
  if (isLikelyBot(req.get("user-agent"))) {
    res.locals.csrfToken = "";
    return next();
  }

  res.locals.csrfToken = generateToken(req);
  next();
}

export function csrfAfterMulter(req, res, next) {
  return csrfSynchronisedProtection(req, res, next);
}
