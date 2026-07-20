import { AppError } from "../utils/error.util.js";

export function partnerMiddleware(req, res, next) {
  if (!req.session?.isLoggedIn) {
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  // Whether someone has a Partner profile is independent of their role name -
  // isPartner reflects the actual presence of a Partner record (checked once at
  // login - see auth.service.js), which is the real source of truth here, not
  // roleName. Same reasoning as employee.middleware.js's isEmployee check.
  if (!req.session.user.isPartner) {
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  req.user = req.session.user;
  next();
}