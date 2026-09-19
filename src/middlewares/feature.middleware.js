import { FEATURES } from "../config/features.config.js";
import { AppError } from "../utils/error.util.js";

/**
 * Gates an entire router mount behind a module being enabled for this
 * deployment - see features.config.js. Responds exactly like
 * notFoundHandler (error.middleware.js) would for a route that simply
 * doesn't exist: a disabled module genuinely isn't part of this
 * deployment, not something the visitor is merely unauthorized for, so
 * this is a 404, never a 403.
 *
 * Usage: router.use("/prodavnica", requireModule("shop"), productRoutes) -
 * put it on the mount itself, before the sub-router, so nothing inside that
 * sub-router (including its own more specific 404s) ever runs when the
 * module is off.
 */
export function requireModule(moduleName) {
  return (req, res, next) => {
    if (FEATURES[moduleName]) return next();
    next(new AppError(`Stranica "${req.originalUrl}" nije pronađena`, 404, { name: "NotFoundError" }));
  };
}

export default { requireModule };
