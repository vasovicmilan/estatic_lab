import "dotenv/config";
import express from "express";

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
import routes from "./routes/index.routes.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

setupHelmet(app);
setupCors(app);
setupStatic(app);
setupMorgan(app);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

setupMethodOverride(app);
setupSanitize(app);


setupSession(app);
setupFlash(app); 
app.use(localsMiddleware);
app.use(csrfLocals);
app.use(csrfWebProtection);

app.use((req, res, next) => {
  if (!req.originalUrl.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, private");
  }
  next();
});

setupViewEngine(app);
app.use(globalLimiter);

app.use("/", routes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;