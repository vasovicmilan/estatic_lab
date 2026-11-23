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

/** Passes when the user holds at least one of the listed permissions. */
export function requireAnyPermission(...permissionList) {
  return (req, res, next) => {
    if (!req.user) {
      if (isApiRequest(req)) return next(new AuthenticationError("Morate biti prijavljeni"));
      req.flash("error", "Morate biti prijavljeni");
      return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    const held = req.user.permissions || [];
    if (permissionList.some((p) => held.includes(p))) return next();
    return next(new AppError("Nemate dozvolu za pristup ovoj stranici", 403));
  };
}

/**
 * Permanent deletion is reserved for the "admin" role. Managers (blog / services / shop) get a
 * reversible alternative instead - archive / deactivate - so a mistaken click never loses data
 * that appointments, purchases, orders or backlinks still point to.
 * Mounted once on the admin router: every DELETE under /admin passes through here.
 */
export function requireAdminForDelete(req, res, next) {
  if (req.method !== "DELETE") return next();
  if (req.user?.roleName === "admin") return next();

  auditLogService.recordAuditLog({
    actor: req.user,
    action: "PERMISSION_DENIED",
    entity: { type: "Route", id: null },
    changes: { path: { old: null, new: req.originalUrl }, requiredPermission: { old: null, new: "admin role (hard delete)" } },
    req,
    success: false,
    errorMessage: "Trajno brisanje je dozvoljeno samo administratoru",
  });
  if (isApiRequest(req)) return next(new AppError("Trajno brisanje je dozvoljeno samo administratoru", 403));
  req.flash("error", "Trajno brisanje je dozvoljeno samo administratoru. Možete deaktivirati ili arhivirati stavku.");
  return res.redirect(req.get("referer") || "/admin");
}

export default { requirePermission, requireAnyPermission, requireAdminForDelete };