import { AppError, AuthenticationError, isApiRequest } from "../utils/error.util.js";
import auditLogService from "../services/audit-log.service.js";

export function employeeMiddleware(req, res, next) {
  // See admin.middleware.js's comment - req.user (not req.session) is the
  // method-agnostic signal, set by session or Bearer-token auth alike.
  if (!req.user) {
    if (isApiRequest(req)) {
      return next(new AuthenticationError("Morate biti prijavljeni"));
    }
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  // Whether someone has an Employee profile is independent of their role name - an
  // admin can also be an employee (see employee.service.js's createEmployee, which no
  // longer overwrites a higher-priority role). isEmployee reflects the actual presence
  // of an Employee record (checked once at login - see auth.service.js), which is the
  // real source of truth here, not roleName.
  if (!req.user.isEmployee) {
    // Same fire-and-forget convention as permission.middleware.js's requirePermission.
    auditLogService.recordAuditLog({
      actor: req.user,
      action: "PERMISSION_DENIED",
      entity: { type: "Route", id: null },
      changes: { path: { old: null, new: req.originalUrl }, requiredPermission: { old: null, new: "isEmployee" } },
      req,
      success: false,
      errorMessage: "Nemate pravo pristupa ovoj stranici",
    });
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  next();
}