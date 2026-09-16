export class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = options.name || "AppError";
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details || null;
    this.errorCode = options.errorCode || null;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resurs") {
    super(`${entity} nije pronađen`, 404, { name: "NotFoundError" });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validacija nije uspela", details = null) {
    super(message, 400, { name: "ValidationError", details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Konflikt sa postojećim podacima") {
    super(message, 409, { name: "ConflictError" });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Neispravni kredencijali") {
    super(message, 401, { name: "AuthenticationError" });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Nemate pravo pristupa") {
    super(message, 403, { name: "AuthorizationError" });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Previše zahteva. Pokušajte ponovo kasnije.") {
    super(message, 429, { name: "RateLimitError" });
  }
}

export function badRequest(message = "Neispravan zahtev", details = null) {
  throw new AppError(message, 400, { details });
}

export function validationError(field, details = null) {
  throw new AppError(`Polje '${field}' nije validno`, 400, { details });
}

export function unauthorized(message = "Neautorizovan pristup") {
  throw new AppError(message, 401);
}

export function forbidden(message = "Nemate dozvolu") {
  throw new AppError(message, 403);
}

export function notFound(entity = "Resurs") {
  throw new AppError(`${entity} nije pronađen`, 404);
}

export function conflict(message = "Konflikt sa postojećim podacima") {
  throw new AppError(message, 409);
}

export function internalError(message = "Interna greška servera") {
  throw new AppError(message, 500, { isOperational: false });
}

export function wrapError(error) {
  if (error instanceof AppError) {
    return error;
  }

  // csrf-sync (via http-errors) throws a plain, well-formed 403 tagged
  // error.code === "EBADCSRFTOKEN" for a missing/stale/mismatched token -
  // overwhelmingly a scanner POSTing to a random path with no real token at
  // all (GraphQL/wp-json/MCP probes etc.), occasionally a real visitor's
  // stale tab after a session refresh. Neither is an application bug. Without
  // this check it fell through to the generic isOperational: false branch
  // below - wrongly flagging it as a "genuinely unexpected error" the same
  // way an actual 500 would be, which made globalErrorHandler's
  // `isGenuineError = statusCode >= 500 || !isOperational` check fire on
  // every single rejected scan attempt: logged at `error` level and pinged to
  // Telegram every time, burying the alerts that actually matter under
  // routine, already-blocked bot noise (see globalErrorHandler's own comment
  // about not alerting on scanner 404s - this is the exact same class of
  // noise, just a 403 instead of a 404). Marking it isOperational: true here
  // routes it through the same "routine, not a bug" path as everything else
  // in that comment - logWarn, no Telegram alert - and gives a real visitor
  // who hits it a sensible message instead of "Interna greška servera".
  if (error.code === "EBADCSRFTOKEN") {
    return new AppError("Sesija je istekla ili je zahtev nevalidan - osvežite stranicu i pokušajte ponovo", error.statusCode || 403, {
      name: "CsrfError",
      isOperational: true,
    });
  }

  // Always captured, in every environment - this `details` is only ever read by
  // logError() (server-side log file) and by buildWebErrorContext(), which itself
  // gates what actually reaches the browser response by NODE_ENV. Gating it here
  // too meant that in production the *original* error's message/stack never even
  // reached the log file, not just the browser - a raw 500 became genuinely
  // undebuggable from the logs alone.
  const details = { originalMessage: error.message, stack: error.stack };

  return new AppError("Interna greška servera", error.statusCode || 500, {
    isOperational: false,
    details,
  });
}

// Shared with the four role-gating middlewares (admin/permission/employee/partner) so
// an unauthenticated /api request gets a JSON 401 instead of the web flow's redirect
// to /prijava (an HTML login page - nonsensical for a JSON client). Single source of
// truth for "is this an API-style request" - was previously a local, unexported copy
// inside error.middleware.js only.
export function isApiRequest(req) {
  return (
    req.originalUrl.startsWith("/api") ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"))
  );
}

export function buildWebErrorContext(err, req, extra = {}) {
  const statusCode = err.statusCode || 500;
  const errorId = extra.errorId || Math.random().toString(36).slice(2, 10);

  return {
    statusCode,
    errorId,
    errorMsg: err.isOperational ? err.message : "Došlo je do neočekivane greške.",
    errorDetails: process.env.NODE_ENV === "development" ? err.stack || err.details : null,
    isOperational: err.isOperational,
    csrfToken: req?.res?.locals?.csrfToken || null,
    isAuthenticated: !!req?.session?.isLoggedIn,
    user: req?.session?.user || null,
    path: req?.originalUrl || "/error",
  };
}

export function buildApiErrorPayload(err, req, extra = {}) {
  const statusCode = err.statusCode || 500;
  const errorId = extra.errorId || Math.random().toString(36).slice(2, 10);

  const payload = {
    success: false,
    error: {
      id: errorId,
      status: statusCode,
      message: err.isOperational ? err.message : "Internal server error",
      code: err.errorCode || null,
    },
  };

  // details is meant for intentionally-thrown operational errors (e.g. validation
  // field details) that the client is supposed to see. Non-operational errors now
  // always carry details too (see wrapError) - but that's for the server log only,
  // never for the client, so it's gated on isOperational here specifically.
  if (err.details && err.isOperational) {
    payload.error.details = err.details;
  }

  if (process.env.NODE_ENV === "development") {
    payload.error.stack = err.stack;
  }

  return { statusCode, payload, errorId };
}

export function normalizeError(error) {
  if (error.statusCode) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error.name === "ValidationError" && error.errors) {
    const firstMessage = Object.values(error.errors)[0]?.message || error.message;
    return { statusCode: 400, message: firstMessage };
  }
  if (error.name === "CastError") {
    return { statusCode: 400, message: "Neispravan format podataka" };
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "polje";
    return { statusCode: 409, message: `Vrednost za '${field}' je već zauzeta` };
  }
  return { statusCode: null, message: error.message };
}