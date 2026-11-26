import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { timingSafeEqual } from "crypto";
import { AppError } from "../utils/error.util.js";
import { logWarn } from "../utils/logger.util.js";

// Limits are tunable per deployment without a code change (.env): RATE_LIMIT_GLOBAL_MAX,
// RATE_LIMIT_API_MAX, RATE_LIMIT_ADMIN_MAX (requests per minute per client). Defaults are
// deliberately generous - the strict limiters below (login, register, contact, booking...)
// are what actually protect abuse-prone actions; these three only exist as a flood guard.
function envInt(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Pravi statički fajlovi NIKAD ne stižu do limitera: express.static (setupStatic u app.js) je montiran
// pre njih i sam odgovara. Zato ovde namerno NEMA izuzetka po ekstenziji ili po prefiksu putanje -
// takav izuzetak je puštao svaki NEPOSTOJEĆI "fajl" (/blog/x.txt, /api/v1/.../x.json) da bez ikakvog
// limita stigne do ruta, sesije i baze.
//
// Jedini izuzetak od običnog limita su video uputstva i posteri: to su dinamičke rute (pristup se proverava
// po fajlu), a jedna strana ima desetine postera i video koji se vuče u mnogo Range zahteva. Oni nisu
// neograničeni, već imaju SVOJU, višu kvotu. Obrazac mora da odgovara samo tim dvema rutama
// (routes/web/tutorial.routes.js), a ne bilo čemu ispod /uputstva/.
const TUTORIAL_MEDIA_PATH = /^\/uputstva\/(?:video\/[^/]+\/[^/]+\/[^/]+\.mp4|poster\/[^/]+\/[^/]+\.jpg)\/?$/i;

export function isTutorialMedia(req) {
  return (req.method === "GET" || req.method === "HEAD") && TUTORIAL_MEDIA_PATH.test(req.path || "");
}

// /api/v1 ima svoj apiLimiter (routes/index.routes.js). Samo TAJ prefiks sme da se preskoči u globalnom
// limiteru: ostalo pod /api/ nema nijedan drugi limit. Bez razlike u velikim/malim slovima, kao Express.
const API_V1_PATH = /^\/api\/v1(?:[/?]|$)/i;

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

// globalLimiter radi PRE sesije, CSRF-a i prikaza stranica (vidi app.js), pa i odgovor mora da bude jeftin:
// običan tekst, bez šablona, bez upisa u sesiju i bez reda u logu za svaki blokiran zahtev. Umesto
// hiljada redova pod naletom, jednom u minuti se upiše koliko ih je blokirano.
let blockedSinceLastReport = 0;
const blockedReportTimer = setInterval(() => {
  if (blockedSinceLastReport > 0) {
    logWarn("[rate-limit] Blokirani zahtevi (globalni limit) u poslednjem minutu", { count: blockedSinceLastReport });
    blockedSinceLastReport = 0;
  }
}, 60 * 1000);
blockedReportTimer.unref();

export function globalLimitExceeded(req, res) {
  blockedSinceLastReport += 1;
  res.status(429).set("Cache-Control", "no-store").type("text/plain; charset=utf-8").send("Previše zahteva - pokušajte ponovo kasnije.");
}

const globalMax = envInt("RATE_LIMIT_GLOBAL_MAX", 100);
const mediaMax = envInt("RATE_LIMIT_MEDIA_MAX", 600);

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isTutorialMedia(req) ? mediaMax : globalMax),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (isTutorialMedia(req) ? `media:${clientKey(req)}` : clientKey(req)),
  // /api/v1 is not counted here too - that made every API call spend from TWO buckets, so the
  // effective limit was the lower of the two.
  skip: (req) => skipInTest() || API_V1_PATH.test(req.originalUrl || ""),
  handler: globalLimitExceeded,
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

// Prize wheel at a fair: many visitors share ONE address (venue wifi / carrier NAT), so this has to
// be far looser than the contact limiter. The real brake on abuse is one spin per email/phone plus
// the limited prize stock (see wheel.service.js) - this only stops a script from hammering the endpoint.
export const wheelLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: envInt("RATE_LIMIT_WHEEL_MAX", 80),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja sa ove mreže - sačekajte nekoliko minuta ili se javite osoblju na štandu."),
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
  max: envInt("RATE_LIMIT_API_MAX", 120),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  skip: skipInTest,
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
  max: envInt("RATE_LIMIT_ADMIN_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva ka admin panelu.", 429),
});

// ---- API tokeni (npr. Claude asistent): ograničenje po TOKENU, ne po IP adresi ----
const tokenKey = (req) => req.user?.tokenId || clientKey(req);
const notToken = (req) => skipInTest() || req.user?.via !== "api-token";
const isRead = (req) => req.method === "GET" || req.method === "HEAD";

export const apiTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt("RATE_LIMIT_TOKEN_MAX", 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tokenKey,
  skip: notToken,
  handler: handleRateLimitExceeded("Previše zahteva za ovaj token.", 429),
});

export const apiTokenWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt("RATE_LIMIT_TOKEN_WRITE_MAX", 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tokenKey,
  skip: (req) => notToken(req) || isRead(req),
  handler: handleRateLimitExceeded("Previše izmena u minuti za ovaj token.", 429),
});

// dnevni plafon upisa: greška u petlji ne sme da napravi stotine nacrta
export const apiTokenDailyWriteLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: envInt("RATE_LIMIT_TOKEN_WRITE_DAY_MAX", 200),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tokenKey,
  skip: (req) => notToken(req) || isRead(req),
  handler: handleRateLimitExceeded("Dnevni limit izmena za ovaj token je potrošen.", 429),
});
