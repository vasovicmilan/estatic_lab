import { AppError, isApiRequest } from "../utils/error.util.js";

export function adminMiddleware(req, res, next) {
  // req.user is set by whichever auth ran before this - webAuthMiddleware (session)
  // for the web app, apiAuthMiddleware (Bearer JWT) for a future /api mount. Checking
  // req.session directly here (as this used to) meant a valid Bearer token could never
  // actually pass this gate, even once apiAuthMiddleware verified it and set req.user -
  // this middleware was still looking at a session that a token-only request never has.
  if (!req.user) {
    if (isApiRequest(req)) {
      return res.status(401).json({ success: false, message: "Unauthorized - morate biti prijavljeni" });
    }
    req.flash("error", "Morate biti prijavljeni");
    return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  const permissions = req.user.permissions || [];
  if (!permissions.includes("access_admin_panel")) {
    return next(new AppError("Nemate pravo pristupa admin panelu", 403));
  }

  next();
}