import { AppError } from "../utils/error.util.js";

export function adminMiddleware(req, res, next) {
  if (!req.session?.isLoggedIn) {
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  const permissions = req.session.user?.permissions || [];
  if (!permissions.includes("access_admin_panel")) {
    return next(new AppError("Nemate pravo pristupa admin panelu", 403));
  }

  req.user = req.session.user;
  next();
}