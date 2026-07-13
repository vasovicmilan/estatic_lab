import { AppError } from "../utils/error.util.js";

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session?.isLoggedIn) {
      req.flash("error", "Morate biti prijavljeni");
      return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    const permissions = req.session.user?.permissions || [];
    if (!permissions.includes(permission)) {
      return next(new AppError("Nemate dozvolu za pristup ovoj stranici", 403));
    }

    next();
  };
}

export default { requirePermission };