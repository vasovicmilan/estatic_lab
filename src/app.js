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
// (see rate-limiter.middleware.js's globalLimiter, applied further down) or a
// well-behaved 30-60s poll could get 429'd during exactly the traffic spike or
// incident when the monitor matters most.
app.use(healthRoutes);

setupCors(app);
setupStatic(app);
setupMorgan(app);
app.use(requestIdMiddleware);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

setupMethodOverride(app);
setupSanitize(app);


// Exposed on the app itself (not just used internally by setupSession) so
// tests can close this session store's own MongoDB client during teardown -
// see test-app.js's closeTestApp for why that matters.
app.set("sessionStore", setupSession(app));
setupFlash(app); 
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
app.use(globalLimiter);
// After every body/session middleware (AsyncLocalStorage context is most reliable when set
// this late) and right before the routes: tells link.builder.js whether this request is web or /api.
app.use(linkContextMiddleware);

app.use("/", routes);

app.use(legacyUrlMiddleware);
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;