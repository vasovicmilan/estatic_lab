import { AppError, AuthenticationError, isApiRequest } from "../utils/error.util.js";

export function requirePermission(permission) {
  return (req, res, next) => {
    // See admin.middleware.js's comment - req.user (not req.session) is the
    // method-agnostic signal, set by session or Bearer-token auth alike.
    if (!req.user) {
      if (isApiRequest(req)) {
        return next(new AuthenticationError("Morate biti prijavljeni"));
      }
      req.flash("error", "Morate biti prijavljeni");
      return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    const permissions = req.user.permissions || [];
    if (!permissions.includes(permission)) {
      return next(new AppError("Nemate dozvolu za pristup ovoj stranici", 403));
    }

    next();
  };
}

export default { requirePermission };