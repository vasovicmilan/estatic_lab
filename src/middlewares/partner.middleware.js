import { AppError, AuthenticationError, isApiRequest } from "../utils/error.util.js";
import auditLogService from "../services/audit-log.service.js";

export function partnerMiddleware(req, res, next) {
  // See admin.middleware.js's comment - req.user (not req.session) is the
  // method-agnostic signal, set by session or Bearer-token auth alike.
  if (!req.user) {
    if (isApiRequest(req)) {
      return next(new AuthenticationError("Morate biti prijavljeni"));
    }
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  // Whether someone has a Partner profile is independent of their role name -
  // isPartner reflects the actual presence of a Partner record (checked once at
  // login - see auth.service.js), which is the real source of truth here, not
  // roleName. Same reasoning as employee.middleware.js's isEmployee check.
  if (!req.user.isPartner) {
    // Same fire-and-forget convention as permission.middleware.js's requirePermission.
    auditLogService.recordAuditLog({
      actor: req.user,
      action: "PERMISSION_DENIED",
      entity: { type: "Route", id: null },
      changes: { path: { old: null, new: req.originalUrl }, requiredPermission: { old: null, new: "isPartner" } },
      req,
      success: false,
      errorMessage: "Nemate pravo pristupa ovoj stranici",
    });
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  next();
}