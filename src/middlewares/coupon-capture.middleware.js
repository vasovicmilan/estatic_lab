const REFERRAL_COOKIE_NAME = "referralCode";
const REFERRAL_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30-day attribution window

// A real partner referral code is a short, human-typed/shared alphanumeric
// string (see coupon.service.js - codes are uppercased, no particular length
// cap in the schema, but every real one created through the admin panel is a
// handful of characters). Google's own OAuth callback ALSO uses "?code=" as
// its query parameter name for the authorization code it hands back - a
// completely different thing that happens to collide with this middleware's
// param name, since this middleware runs site-wide (see the comment below on
// why). Google's codes look nothing like a referral code (70+ characters,
// contains "/", `4/0A...`-style prefix) - this shape check exists so ANY
// value that clearly isn't a plausible referral code gets ignored, not just
// Google's specifically, whatever route it shows up on.
const MAX_PLAUSIBLE_CODE_LENGTH = 32;

function looksLikeReferralCode(code) {
  return code.length <= MAX_PLAUSIBLE_CODE_LENGTH && !code.includes("/");
}

/**
 * A visitor might see a partner's link today and not actually book or buy for
 * another week or two - a plain session (dies when the browser closes, or on
 * session expiry) is too short-lived to attribute that. A dedicated cookie with
 * an explicit window is the standard pattern here for exactly that reason.
 *
 * Deliberately generic about where ?code= can appear - a partner might share a
 * link to a specific service, or just their homepage - so this runs site-wide
 * rather than being wired into any one page. EXCEPT the OAuth callback routes
 * specifically (see below) - those are the one place "?code=" reliably means
 * something else entirely, not a referral.
 */
export function couponCaptureMiddleware(req, res, next) {
  if (req.path.startsWith("/prijava/google/callback")) return next();

  const code = req.query?.code;
  if (code && typeof code === "string" && code.trim() && looksLikeReferralCode(code.trim())) {
    res.cookie(REFERRAL_COOKIE_NAME, code.trim().toUpperCase(), {
      maxAge: REFERRAL_COOKIE_MAX_AGE_MS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  next();
}

export function getCapturedReferralCode(req) {
  return req.cookies?.[REFERRAL_COOKIE_NAME] || null;
}

export default { couponCaptureMiddleware, getCapturedReferralCode };