import flash from "../middlewares/flash.middleware.js";

export function setupFlash(app) {
  app.use(flash());
}
