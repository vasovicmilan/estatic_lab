import rateLimit from "express-rate-limit";
import path from "path";
import { AppError } from "../utils/error.util.js";

function skipStatic(req) {
  if (req.method !== "GET") return false;
  const staticExt = [".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".woff", ".woff2", ".ttf", ".eot", ".ico", ".map", ".mp4", ".webm", ".pdf", ".json"];
  return staticExt.includes(path.extname(req.path).toLowerCase());
}

const skipInTest = () => process.env.NODE_ENV === "test";

function handleRateLimitExceeded(message, statusCode = 429) {
  return (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(statusCode).json({ success: false, message });
    }
    next(new AppError(message, statusCode));
  };
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTest() || skipStatic(req),
  handler: handleRateLimitExceeded("Previše zahteva — pokušajte ponovo kasnije."),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja prijave — pokušajte ponovo za 15 minuta."),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja registracije — pokušajte ponovo za 1 sat."),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva za reset lozinke — pokušajte ponovo za 1 sat."),
});

export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja verifikacije — pokušajte ponovo za 1 sat."),
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
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
  handler: handleRateLimitExceeded("Previše pokušaja — pokušajte ponovo kasnije."),
});

export const testimonialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše testimoniala — pokušajte ponovo za 1 sat."),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pretraga — pokušajte ponovo kasnije."),
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše pokušaja zakazivanja — pokušajte ponovo za 1 minut."),
});

export const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva za proveru dostupnosti — pokušajte ponovo kasnije."),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
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
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: handleRateLimitExceeded("Previše zahteva ka admin panelu.", 429),
});
