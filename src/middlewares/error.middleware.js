import { AppError, wrapError, buildWebErrorContext, buildApiErrorPayload } from "../utils/error.util.js";
import { logError, logWarn, maskSensitive } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

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

  // 4xx (bad input, not found, forbidden, etc.) is routine - the internet is full of
  // scanners probing for .env/wp-content/phpinfo.php on every public IP, and this app
  // correctly answers all of them with a normal 404. Only 5xx (or anything without a
  // clear status - a real bug) is worth error-level attention and a Telegram ping;
  // logging/alerting on every scanner hit would bury the errors that actually matter.
  const isGenuineError = error.statusCode >= 500 || !error.isOperational;
  const logFn = isGenuineError ? logError : logWarn;

  logFn(`Unhandled error [${errorId}]`, error, {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: maskSensitive(req.body),
    userId: req.session?.user?.id,
    ip: req.ip,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    // the wrapped `error` above has its message replaced with the generic
    // "Interna greška servera" for non-operational errors (see wrapError) - these
    // two fields are the only place the actual underlying cause survives into the
    // log file. Always logged (this never reaches the browser response, only the
    // server-side log), regardless of NODE_ENV.
    originalMessage: error.details?.originalMessage,
    originalStack: error.details?.stack,
  });

  if (isGenuineError) {
    alertError(error.message, {
      errorId,
      method: req.method,
      url: req.originalUrl,
      statusCode: error.statusCode,
      env: process.env.NODE_ENV,
    });
  }

  res.set("X-Error-ID", errorId);

  if (isApiRequest(req)) {
    const { statusCode, payload } = buildApiErrorPayload(error, req, { errorId });
    return res.status(statusCode).json(payload);
  }

  const context = buildWebErrorContext(error, req, { errorId });
  return res.status(context.statusCode).render("error/error", context);
}