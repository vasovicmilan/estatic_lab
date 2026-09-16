import { verifyJwt } from "../services/crypto.service.js";

export function webAuthMiddleware(req, res, next) {
  if (req.session?.isLoggedIn) {
    req.user = req.session.user;
    return next();
  }

  req.flash("error", "Morate biti prijavljeni da biste pristupili ovoj stranici");
  return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
}

export function optionalWebAuth(req, res, next) {
  if (req.session?.isLoggedIn) {
    req.user = req.session.user;
  }
  next();
}

export function apiAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    // verifyJwt (crypto.service.js) instead of calling the jsonwebtoken library
    // directly here - same JWT_SECRET validation-at-startup and single place that
    // knows how tokens are signed/verified, rather than this file quietly
    // reaching around that service with its own `import jwt from "jsonwebtoken"`.
    req.user = verifyJwt(token);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
  }
}

export function optionalApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = verifyJwt(authHeader.split(" ")[1]);
    } catch (error) {
      // not logged in - ignore, this is optional
    }
  }
  next();
}
