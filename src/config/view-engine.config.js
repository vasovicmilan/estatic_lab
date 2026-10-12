import path from "path";
import { fileURLToPath } from "url";
import { escapeHtml, jsonForScript } from "../utils/html.util.js";
import { sanitizeRichText } from "../utils/rich-text.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupViewEngine(app) {
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

  // Output helpers for the handful of places a template has to print something
  // other than plain escaped text (see utils/html.util.js and utils/rich-text.util.js):
  //   jsonForScript(x) - JSON for a <script> body, safe against "</script>"
  //   richText(s)      - admin-editable text that may carry <strong>/<a>, rebuilt from an allowlist
  //   escapeHtml(s)    - for markup assembled by hand inside a template
  app.locals.jsonForScript = jsonForScript;
  app.locals.richText = sanitizeRichText;
  app.locals.escapeHtml = escapeHtml;
}
