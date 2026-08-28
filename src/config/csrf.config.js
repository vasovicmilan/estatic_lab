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

export function csrfWebProtection(req, res, next) {
  if (req.originalUrl.startsWith("/api")) return next();

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
