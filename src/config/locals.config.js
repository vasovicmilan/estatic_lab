import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import userService from "../services/user.service.js";
import { buildOrganizationJsonLd } from "../seo/organization.builder.js";
import { getCurrency } from "./runtime-settings.cache.js";
import { logError, logWarn } from "../utils/logger.util.js";
import BUSINESS from "./business.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_VERSION = Date.now();

// Read once at server start, not per-request: bootstrap-icons.subset.css
// (see scripts/build-icon-subset.mjs, npm run build:icons) is small enough
// (~2.7 KiB) to inline directly in <head> as a <style> block instead of a
// separate <link>, which removes one full network round-trip from the
// render-blocking critical path - PageSpeed's "Network dependency tree" audit
// showed this CSS -> font chain as the single longest blocking hop even after
// subsetting, because a chained request costs the same latency regardless of
// how small the file is. Falls back to null (head.ejs then links the file
// externally instead) if the build step hasn't been run yet - e.g. a fresh
// clone before its first `npm run build:icons` - so a missing build artifact
// degrades gracefully rather than crashing server startup.
let ICONS_INLINE_CSS = null;
try {
  ICONS_INLINE_CSS = fs.readFileSync(path.join(__dirname, "..", "public", "css", "bootstrap-icons.subset.css"), "utf8");
} catch (error) {
  logWarn("[locals.config] bootstrap-icons.subset.css not found - run `npm run build:icons`. Falling back to external <link>.", {
    error: error.message,
  });
}

export async function localsMiddleware(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.isLoggedIn = !!req.session?.isLoggedIn;
  res.locals.user = req.session?.user || null;
  res.locals.assetVersion = ASSET_VERSION;
  res.locals.iconsInlineCss = ICONS_INLINE_CSS;
  res.locals.orgJsonLd = await buildOrganizationJsonLd(req);
  // Exposed globally (not just via specific presenters) so shared includes
  // like footer.ejs, which render on every page regardless of which
  // controller/presenter built the page, can read address/PIB/matični broj
  // straight from the single source of truth without every presenter having
  // to thread it through.
  res.locals.business = BUSINESS;
  // Admin-editable (see /admin/sajt) - synchronous cache read, not a DB call
  // (runtime-settings.cache.js). For templates that decorate a raw number with
  // a hardcoded currency label directly (rather than going through a mapper's
  // formatMoney call) - e.g. "Iznos u <%= currencySymbol %>" instead of a
  // literal "Iznos u RSD".
  res.locals.currencySymbol = getCurrency().symbol;

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