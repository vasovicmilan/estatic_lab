import { AppError } from "../utils/error.util.js";

export function employeeMiddleware(req, res, next) {
  if (!req.session?.isLoggedIn) {
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  // Whether someone has an Employee profile is independent of their role name - an
  // admin can also be an employee (see employee.service.js's createEmployee, which no
  // longer overwrites a higher-priority role). isEmployee reflects the actual presence
  // of an Employee record (checked once at login - see auth.service.js), which is the
  // real source of truth here, not roleName.
  if (!req.session.user.isEmployee) {
    return next(new AppError("Nemate pravo pristupa ovoj stranici", 403));
  }

  req.user = req.session.user;
  next();
}