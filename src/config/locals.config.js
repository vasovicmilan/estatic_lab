import userService from "../services/user.service.js";
import { logError } from "../utils/logger.util.js";

export async function localsMiddleware(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.isLoggedIn = !!req.session?.isLoggedIn;
  res.locals.user = req.session?.user || null;

  res.locals.success = req.flash ? req.flash("success") : [];
  res.locals.error = req.flash ? req.flash("error") : [];
  res.locals.info = req.flash ? req.flash("info") : [];
  res.locals.warning = req.flash ? req.flash("warning") : [];

  try {
    if (req.originalUrl.startsWith("/api")) {
      res.locals.cartCount = 0;
    } else if (res.locals.isLoggedIn && res.locals.user?.id) {
      res.locals.cartCount = await userService.getCartItemCount(res.locals.user.id);
    } else {
      const guestCart = req.session?.cart || [];
      res.locals.cartCount = guestCart.reduce((sum, line) => sum + (line.quantity || 0), 0);
    }
  } catch (error) {
    logError("[localsMiddleware] Failed to compute cart count", error, { userId: res.locals.user?.id });
    res.locals.cartCount = 0;
  }

  next();
}

export default localsMiddleware;