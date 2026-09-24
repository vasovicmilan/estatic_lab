import { AppError, wrapError, buildWebErrorContext, buildApiErrorPayload, isApiRequest } from "../utils/error.util.js";
import { logError, logWarn, maskSensitive } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";
import { generateErrorId } from "../services/crypto.service.js";

export function notFoundHandler(req, res, next) {
  next(new AppError(`Stranica "${req.originalUrl}" nije pronađena`, 404, { name: "NotFoundError" }));
}

export function globalErrorHandler(err, req, res, next) {
  const error = wrapError(err);
  const errorId = generateErrorId();

  // 4xx (bad input, not found, forbidden, etc.) is routine - the internet is full of
  // scanners probing for .env/wp-content/phpinfo.php on every public IP, and this app
  // correctly answers all of them with a normal 404. Only 5xx (or anything without a
  // clear status - a real bug) is worth error-level attention and a Telegram ping;
  // logging/alerting on every scanner hit would bury the errors that actually matter.
  const isGenuineError = error.statusCode >= 500 || !error.isOperational;
  const logFn = isGenuineError ? logError : logWarn;

  // The label must say what actually happened - "Unhandled error" on every line
  // (including routine, fully handled 404/403s) made the log look like the app was
  // crashing constantly. Only a non-operational error is a real unexpected bug.
  let label;
  if (!error.isOperational) label = "Unexpected error";
  else if (error.statusCode >= 500) label = "Server error";
  else label = "Handled error";

  logFn(`${label} [${errorId}] ${error.name} ${error.statusCode} ${req.method} ${req.originalUrl}`, error, {
    errorId,
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