import flash from "connect-flash";

export function setupFlash(app) {
  app.use(flash());
}
