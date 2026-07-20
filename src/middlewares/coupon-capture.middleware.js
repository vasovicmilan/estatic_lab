const REFERRAL_COOKIE_NAME = "referralCode";
const REFERRAL_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30-day attribution window

/**
 * A visitor might see a partner's link today and not actually book or buy for
 * another week or two - a plain session (dies when the browser closes, or on
 * session expiry) is too short-lived to attribute that. A dedicated cookie with
 * an explicit window is the standard pattern here for exactly that reason.
 *
 * Deliberately generic about where ?code= can appear - a partner might share a
 * link to a specific service, or just their homepage - so this runs site-wide
 * rather than being wired into any one page.
 */
export function couponCaptureMiddleware(req, res, next) {
  const code = req.query?.code;
  if (code && typeof code === "string" && code.trim()) {
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