import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import { setupHelmet } from "./config/helmet.config.js";
import { setupCors } from "./config/cors.config.js";
import { setupStatic } from "./config/static.config.js";
import { setupMorgan } from "./config/morgan.config.js";
import { setupMethodOverride } from "./config/method-override.config.js";
import { setupSanitize } from "./config/sanitize.config.js";
import { setupSession } from "./config/session.config.js";
import { setupFlash } from "./config/flash.config.js";
import { setupViewEngine } from "./config/view-engine.config.js";
import localsMiddleware from "./config/locals.config.js";
import { csrfLocals, csrfWebProtection } from "./config/csrf.config.js";
import { globalLimiter } from "./middlewares/rate-limiter.middleware.js";
import { sessionRevalidation } from "./middlewares/auth.middleware.js";
import { couponCaptureMiddleware } from "./middlewares/coupon-capture.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { linkContextMiddleware } from "./middlewares/link-context.middleware.js";
import routes from "./routes/index.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { legacyUrlMiddleware } from "./middlewares/legacy-url.middleware.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

setupHelmet(app);

// Mounted before CORS/session/CSRF/globalLimiter and everything else below - an
// uptime monitor needs no auth, no cookies, and must not be caught by globalLimiter
// (see rate-limiter.middleware.js's globalLimiter, applied right after static files) or a
// well-behaved 30-60s poll could get 429'd during exactly the traffic spike or
// incident when the monitor matters most.
app.use(healthRoutes);

setupCors(app);
setupStatic(app);

// Odmah posle statike i /health, PRE morgan-a, sesije, CSRF-a i prikaza stranica: zahtev koji će ionako biti
// odbijen ne sme da košta upis sesije u bazu, upit za podešavanja ni red u logu. (Ranije je limiter bio
// iza svega toga, pa je napad sa mnogo adresa plaćao pun put kroz aplikaciju pre nego što bi dobio 429.)
app.use(globalLimiter);

setupMorgan(app);
app.use(requestIdMiddleware);

// Telo zahteva se čita u memoriju PRE autentikacije, pa je svaki dozvoljeni megabajt trošak koji može da
// napravi bilo ko. Javne forme (kontakt, newsletter, prijava, korpa, zakazivanje) su male: 100 KB je
// dovoljno. Veći limit ostaje samo za admin panel i API, gde se šalju sadržaji blokova i objave.
const LARGE_BODY_PREFIXES = ["/admin", "/api"];
const isLargeBodyPath = (req) => LARGE_BODY_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
const jsonLarge = express.json({ limit: "5mb" });
const jsonSmall = express.json({ limit: "100kb" });
const urlencodedLarge = express.urlencoded({ extended: true, limit: "5mb" });
const urlencodedSmall = express.urlencoded({ extended: true, limit: "100kb" });
app.use((req, res, next) => (isLargeBodyPath(req) ? jsonLarge : jsonSmall)(req, res, next));
app.use((req, res, next) => (isLargeBodyPath(req) ? urlencodedLarge : urlencodedSmall)(req, res, next));
// preveliko telo: običan tekst odmah (stranica greške traži podatke koje tek postavljaju kasniji middleware-i)
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).set("Cache-Control", "no-store").type("text/plain; charset=utf-8").send("Zahtev je prevelik.");
  }
  return next(err);
});
app.use(cookieParser());

setupMethodOverride(app);
setupSanitize(app);


// Exposed on the app itself (not just used internally by setupSession) so
// tests can close this session store's own MongoDB client during teardown -
// see test-app.js's closeTestApp for why that matters.
app.set("sessionStore", setupSession(app));
setupFlash(app); 
app.use(sessionRevalidation);
app.use(localsMiddleware);
app.use(csrfLocals);
app.use(csrfWebProtection);
app.use(couponCaptureMiddleware);

app.use((req, res, next) => {
  if (!req.originalUrl.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, private");
  }
  next();
});

setupViewEngine(app);
// After every body/session middleware (AsyncLocalStorage context is most reliable when set
// this late) and right before the routes: tells link.builder.js whether this request is web or /api.
app.use(linkContextMiddleware);

app.use("/", routes);

app.use(legacyUrlMiddleware);
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;