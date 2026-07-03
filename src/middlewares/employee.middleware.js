import { AppError } from "../utils/error.util.js";

export function employeeMiddleware(req, res, next) {
  if (!req.session?.isLoggedIn) {
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  if (req.session.user.roleName !== "employee") {
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  req.user = req.session.user;
  next();
}