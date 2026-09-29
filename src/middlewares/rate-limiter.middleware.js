import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { timingSafeEqual } from "crypto";
import path from "path";
import { AppError } from "../utils/error.util.js";

// Limits are tunable per deployment without a code change (.env): RATE_LIMIT_GLOBAL_MAX,
// RATE_LIMIT_API_MAX, RATE_LIMIT_ADMIN_MAX (requests per minute per client). Defaults are
// deliberately generous - the strict limiters below (login, register, contact, booking...)
// are what actually protect abuse-prone actions; these three only exist as a flood guard.
function envInt(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const STATIC_EXTENSIONS = new Set([
  ".js", ".mjs", ".css", ".png", ".jpg", ".jpeg", ".jfif", ".webp", ".avif", ".svg", ".gif", ".bmp", ".ico",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".map", ".mp4", ".webm", ".mov", ".mp3", ".pdf", ".json", ".txt", ".xml",
]);
// Static/uploaded resources (images, videos, css/js, fonts) never count toward any limit -
// express.static already answers most of them before the limiters run (setupStatic in app.js),
// this is the safety net for the ones that get here anyway (nginx-less setups, uploads path,
// files without a listed extension).
const STATIC_PREFIXES = ["/images/", "/uploads/", "/videos/", "/css/", "/js/", "/fonts/", "/bootstrap/", "/assets/"];

function skipStatic(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const p = (req.path || "").toLowerCase();
  if (STATIC_PREFIXES.some((prefix) => p.startsWith(prefix))) return true;
  return STATIC_EXTENSIONS.has(path.extname(p));
}

// Angular SSR renders pages on ITS server and calls this API from there, so without help every
// visitor would appear as the SSR server's single IP and share one bucket. When SSR_SHARED_SECRET
// is set, a request carrying that secret in X-SSR-Secret may name the real visitor in X-Client-IP
// and gets counted per visitor. Without a matching secret the header is ignored (can't be spoofed).
function clientKey(req) {
  const secret = process.env.SSR_SHARED_SECRET;
  const provided = req.get("x-ssr-secret");
  if (secret && provided && provided.length === secret.length && timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    const forwarded = String(req.get("x-client-ip") || "").trim();
    if (forwarded && forwarded.length <= 64) return ipKeyGenerator(forwarded);
  }
  return ipKeyGenerator(req.ip);
}

const skipInTest = () => process.env.NODE_ENV === "test";

function handleRateLimitExceeded(message, statusCode = 429) {
  return (req, res, next) => {
    // Same path for web and /api: globalErrorHandler renders HTML or the standard
    // JSON error shape depending on the request (isApiRequest), so a rate-limited
    // API client gets the same { success:false, error:{ id, status, message, code } }
    // as every other error instead of a one-off { success, message } body.
    next(new AppError(message, statusCode, { name: "RateLimitError" }));
  };
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt("RATE_LIMIT_GLOBAL_MAX", 600),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  // /api/v1 has its own apiLimiter (routes/index.routes.js) - counting it here too meant every
  // API call spent from TWO buckets, so the effective limit was the lower of the two.
  skip: (req) => skipInTest() || skipStatic(req) || (req.originalUrl || "").startsWith("/api/"),
  handler: handleRateLimitExceeded("Previše zahteva - pokušajte ponovo kasnije."),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja prijave - pokušajte ponovo za 15 minuta."),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja registracije - pokušajte ponovo za 1 sat."),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva za reset lozinke - pokušajte ponovo za 1 sat."),
});

export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja verifikacije - pokušajte ponovo za 1 sat."),
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Možete poslati samo jednu poruku u minuti."),
});

export const newsletterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja - pokušajte ponovo kasnije."),
});

export const testimonialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše testimoniala - pokušajte ponovo za 1 sat."),
});

export const couponLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja sa kodom kupona - pokušajte ponovo za nekoliko minuta."),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pretraga - pokušajte ponovo kasnije."),
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja zakazivanja - pokušajte ponovo za 1 minut."),
});

export const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva za proveru dostupnosti - pokušajte ponovo kasnije."),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt("RATE_LIMIT_API_MAX", 600),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  skip: (req) => skipInTest() || skipStatic(req),
  handler: handleRateLimitExceeded("API rate limit exceeded.", 429),
});

export const apiAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše API auth pokušaja.", 429),
});

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt("RATE_LIMIT_ADMIN_MAX", 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTest() || skipStatic(req),
  handler: handleRateLimitExceeded("Previše zahteva ka admin panelu.", 429),
});