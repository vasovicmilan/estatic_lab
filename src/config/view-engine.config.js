import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupViewEngine(app) {
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));
}
