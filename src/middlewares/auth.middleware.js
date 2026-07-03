import jwt from "jsonwebtoken";

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
    return res.status(401).json({ success: false, message: "Unauthorized — no token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Unauthorized — invalid token" });
  }
}

export function optionalApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch (error) {
      // not logged in — ignore, this is optional
    }
  }
  next();
}