import { AppError, isApiRequest } from "../utils/error.util.js";

export function partnerMiddleware(req, res, next) {
  // See admin.middleware.js's comment - req.user (not req.session) is the
  // method-agnostic signal, set by session or Bearer-token auth alike.
  if (!req.user) {
    if (isApiRequest(req)) {
      return res.status(401).json({ success: false, message: "Unauthorized - morate biti prijavljeni" });
    }
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  // Whether someone has a Partner profile is independent of their role name -
  // isPartner reflects the actual presence of a Partner record (checked once at
  // login - see auth.service.js), which is the real source of truth here, not
  // roleName. Same reasoning as employee.middleware.js's isEmployee check.
  if (!req.user.isPartner) {
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  next();
}