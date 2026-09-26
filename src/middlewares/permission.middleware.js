import { AppError, AuthenticationError, isApiRequest } from "../utils/error.util.js";
import auditLogService from "../services/audit-log.service.js";

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
      // Fire-and-forget, deliberately not awaited - this middleware must stay
      // synchronous-shaped (next() below can't wait on a DB write), and
      // recordAuditLog already swallows its own failures. entity carries the
      // route + the permission that was missing since there's no single
      // "entity" a permission check is about - no schema change needed, this
      // is exactly what the entity.type/id pair is flexible enough to hold.
      auditLogService.recordAuditLog({
        actor: req.user,
        action: "PERMISSION_DENIED",
        entity: { type: "Route", id: null },
        changes: { path: { old: null, new: req.originalUrl }, requiredPermission: { old: null, new: permission } },
        req,
        success: false,
        errorMessage: "Nemate dozvolu za pristup ovoj stranici",
      });
      return next(new AppError("Nemate dozvolu za pristup ovoj stranici", 403));
    }

    next();
  };
}

export default { requirePermission };