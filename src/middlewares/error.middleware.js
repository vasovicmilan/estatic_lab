import { AppError, wrapError, buildWebErrorContext, buildApiErrorPayload } from "../utils/error.util.js";
import { logError, maskSensitive } from "../utils/logger.util.js";

function isApiRequest(req) {
  return (
    req.originalUrl.startsWith("/api") ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"))
  );
}

export function notFoundHandler(req, res, next) {
  next(new AppError(`Stranica "${req.originalUrl}" nije pronađena`, 404, { name: "NotFoundError" }));
}

export function globalErrorHandler(err, req, res, next) {
  const error = wrapError(err);
  const errorId = Math.random().toString(36).slice(2, 10);

  logError(`Unhandled error [${errorId}]`, error, {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: maskSensitive(req.body),
    userId: req.session?.user?.id,
    ip: req.ip,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
  });

  res.set("X-Error-ID", errorId);

  if (isApiRequest(req)) {
    const { statusCode, payload } = buildApiErrorPayload(error, req, { errorId });
    return res.status(statusCode).json(payload);
  }

  const context = buildWebErrorContext(error, req, { errorId });
  return res.status(context.statusCode).render("error/error", context);
}