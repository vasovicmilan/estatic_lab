// Deployment-time module toggle for white-label clients who don't buy every
// part of the platform - see docs/*/16-module-feature-flags.md for the full
// picture. Deliberately env-driven (not the DB-backed runtime-settings.cache.js
// pattern used for booking policy/currency/commission): which modules exist for
// a client is decided when their server is set up (see DEPLOYMENT.md's one
// pm2 process per client), not something an admin should be able to casually
// flip in a UI - disabling "booking" isn't a preference, it changes what data
// and permissions even make sense to have.
//
// ENABLED_MODULES is a comma-separated list drawn from BASE_MODULES below.
// Every combination is valid, including all three or just one - see
// requireModule() in middlewares/feature.middleware.js for how a disabled
// module's routes respond, and locals.config.js for how this reaches EJS.
const BASE_MODULES = ["blog", "shop", "booking"];

function parseEnabledModules() {
  const raw = (process.env.ENABLED_MODULES || BASE_MODULES.join(",")).split(",").map((m) => m.trim()).filter(Boolean);

  const unknown = raw.filter((m) => !BASE_MODULES.includes(m));
  if (unknown.length > 0) {
    throw new Error(`ENABLED_MODULES contains unknown module(s): ${unknown.join(", ")} - must be a comma-separated subset of ${BASE_MODULES.join(", ")}`);
  }
  if (raw.length === 0) {
    throw new Error("ENABLED_MODULES must enable at least one module");
  }
  return raw;
}

const enabled = new Set(parseEnabledModules());

const blog = enabled.has("blog");
const shop = enabled.has("shop");
const booking = enabled.has("booking");

export const FEATURES = {
  blog,
  shop,
  booking,
  // Derived, not independently configurable - see the module split Milan laid
  // out: a coupon is meaningless with neither a shop nor a booking flow to
  // apply it to, but exists as soon as either one does. Same reasoning for
  // the affiliate/referral partner program (moj-partner-nalog) - it earns
  // commission on shop orders and/or booking appointments, so it needs at
  // least one of them to mean anything. Employees (moj-nalog) are tied to
  // booking specifically - a shop-only or blog-only deployment has no
  // concept of a staff member fulfilling an appointment.
  coupons: shop || booking,
  partners: shop || booking,
  employees: booking,
};

export default FEATURES;
