import { csrfSync } from "csrf-sync";

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

  res.locals.csrfToken = generateToken(req);
  next();
}

export function csrfAfterMulter(req, res, next) {
  return csrfSynchronisedProtection(req, res, next);
}