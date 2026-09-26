import BUSINESS from "../config/business.config.js";
import { getLinkContext } from "./link-context.util.js";
import { logWarn } from "./logger.util.js";

/**
 * Single place that builds every link placed into emails, Telegram alerts and calendar
 * events. The same action can be started from two different "faces" of the platform:
 *
 *   - "web"      the server-rendered website (EJS)          -> BASE_URL, Serbian web paths
 *   - "frontend" a separate frontend using the JSON API     -> FRONTEND_URL, that app's routes
 *                (the Angular app, a mobile deep-link host, a white-label client...)
 *
 * The target is picked, in order, from: an explicit `target` option, the origin of the
 * current request (link-context.middleware.js: /api/* => "frontend", everything else =>
 * "web"), and finally - for work that has no request at all, e.g. cron reminders - the
 * deployment-wide LINKS_DEFAULT_TARGET ("web" by default; flip to "frontend" when the
 * separate frontend takes over the public domain).
 *
 * Adding a new link = one entry in LINK_ROUTES with both variants. Path params are written
 * as :name and filled from `params` (URL-encoded).
 */
export const LINK_TARGETS = Object.freeze({ WEB: "web", FRONTEND: "frontend" });

export const LINK_ROUTES = Object.freeze({
  // ---- Public / account flows (token links from emails) ----
  verifyAccount: { web: "/verifikacija/:token", frontend: "/verifikacija/:token" },
  claimAccount: { web: "/preuzmi-nalog/:token", frontend: "/preuzmi-nalog/:token" },
  resetPassword: { web: "/resetovanje-lozinke/:token", frontend: "/resetovanje-lozinke/:token" },
  newsletterUnsubscribe: { web: "/newsletter/odjava/:token", frontend: "/newsletter/odjava/:token" },
  orderConfirm: { web: "/korpa/potvrda/:orderId/:token", frontend: "/korpa/potvrda/:orderId/:token" },
  cart: { web: "/korpa", frontend: "/korpa" },
  home: { web: "/", frontend: "/" },

  // ---- Customer's own area ----
  accountAppointments: { web: "/nalog/termini", frontend: "/moj-nalog/zakazivanja" },
  accountOrders: { web: "/nalog/porudzbine", frontend: "/moj-nalog/porudzbine" },
  accountPackages: { web: "/nalog/paketi", frontend: "/moj-nalog" },

  // ---- Employee's own area ----
  employeeAppointments: { web: "/moj-nalog/termini", frontend: "/zaposleni-panel/termini" },

  // ---- Admin ----
  adminAppointment: { web: "/admin/termini/detalji/:id", frontend: "/admin/zakazivanja/:id" },
  adminOrder: { web: "/admin/porudzbine/detalji/:id", frontend: "/admin/porudzbine/:id" },
  adminProductEdit: { web: "/admin/proizvodi/izmena/:id", frontend: "/admin/prodavnica/:id" },
  adminContact: { web: "/admin/kontakt/detalji/:id", frontend: "/admin/poruke/:id/pregled" },
});

function stripTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

export function resolveLinkTarget(explicitTarget) {
  if (explicitTarget === LINK_TARGETS.WEB || explicitTarget === LINK_TARGETS.FRONTEND) return explicitTarget;

  const contextTarget = getLinkContext()?.target;
  if (contextTarget) return contextTarget;

  return process.env.LINKS_DEFAULT_TARGET === LINK_TARGETS.FRONTEND ? LINK_TARGETS.FRONTEND : LINK_TARGETS.WEB;
}

/** Origin (no trailing slash) for a target. Frontend falls back to the site origin when FRONTEND_URL isn't set. */
export function getLinkBase(target) {
  if (target === LINK_TARGETS.FRONTEND && process.env.FRONTEND_URL) return stripTrailingSlash(process.env.FRONTEND_URL);
  return stripTrailingSlash(BUSINESS.siteUrl);
}

function appendQuery(url, query) {
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

/**
 * Absolute URL for an arbitrary path that is identical on both faces (e.g. a catalog
 * detail page used for partner referral links: /usluge/:slug?code=...).
 */
export function buildSiteUrl(path, { target, query } = {}) {
  const resolved = resolveLinkTarget(target);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return appendQuery(`${getLinkBase(resolved)}${normalized === "/" ? "/" : normalized}`, query);
}

/**
 * Absolute URL for a named route (see LINK_ROUTES).
 *   buildLink("verifyAccount", { token })
 *   buildLink("adminOrder", { id: order.id }, { target: "web" })
 * A missing path param never throws (an email must not fail to send over a link) - the
 * error is logged and the link degrades to the site root of the resolved target.
 */
export function buildLink(name, params = {}, { target, query } = {}) {
  const route = LINK_ROUTES[name];
  if (!route) throw new Error(`Unknown link route "${name}"`);

  const resolved = resolveLinkTarget(target);
  const base = getLinkBase(resolved);

  let missing = null;
  const path = route[resolved].replace(/:([A-Za-z]+)/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      missing = key;
      return "";
    }
    return encodeURIComponent(String(value));
  });

  if (missing) {
    logWarn(`[link.builder] Nedostaje parametar "${missing}" za link "${name}"`, { name, target: resolved });
    return `${base}/`;
  }

  return appendQuery(`${base}${path}`, query);
}

export default { buildLink, buildSiteUrl, resolveLinkTarget, getLinkBase, LINK_ROUTES, LINK_TARGETS };
