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

  const details =
    process.env.NODE_ENV === "development"
      ? { originalMessage: error.message, stack: error.stack }
      : null;
      
  return new AppError("Interna greška servera", error.statusCode || 500, {
    isOperational: false,
    details,
  });
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

  if (err.details) {
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