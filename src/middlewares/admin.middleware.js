import { AppError } from "../utils/error.util.js";

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