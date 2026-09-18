import redirectService from "../services/redirect.service.js";
import { AppError } from "../utils/error.util.js";
import { logError } from "../utils/logger.util.js";

// Sits right before notFoundHandler (app.js) - runs only for requests
// nothing else matched. Looks up req.path (no query string) against the
// Redirect collection; a "redirect" entry 301s to its target, a "gone" entry
// answers 410 (routed through the normal AppError/globalErrorHandler pipeline
// so it gets the same rendering + isOperational-aware logging as everything
// else - a 410 is exactly as "routine" as a 404, see error.middleware.js).
// Anything not in the table falls through to notFoundHandler unchanged.
export async function legacyUrlMiddleware(req, res, next) {
  try {
    const redirect = await redirectService.resolveRedirect(req.path);
    if (!redirect) return next();

    if (redirect.type === "redirect" && redirect.target) {
      return res.redirect(301, redirect.target);
    }

    if (redirect.type === "gone") {
      return next(new AppError(`Stranica "${req.originalUrl}" je trajno uklonjena`, 410, { name: "GoneError" }));
    }

    return next();
  } catch (error) {
    // A broken redirect lookup should never take the whole 404 path down
    // with it - log it and let the request fall through to the normal 404.
    logError("[legacyUrlMiddleware] Greška pri proveri redirect tabele", error, { path: req.path });
    return next();
  }
}

export default legacyUrlMiddleware;
