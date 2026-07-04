import { AppError } from "../utils/error.util.js";

/**
 * Trusts `req.session.user.roleName`, set at login (see auth.controller.js). This is a
 * deliberate simplification vs. a DB lookup on every request — if an admin's role is
 * revoked mid-session, they keep admin access until they log in again. Acceptable for
 * estatic_lab's scale; swap for a per-request roleService lookup if that gap matters.
 */
export function adminMiddleware(req, res, next) {
  if (!req.session?.isLoggedIn) {
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  if (req.session.user.roleName !== "admin") {
    return next(new AppError("Nemate pravo pristupa admin panelu", 403));
  }

  req.user = req.session.user;
  next();
}
