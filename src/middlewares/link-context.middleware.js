import { runWithLinkContext } from "../utils/link-context.util.js";

// Marks the request as coming from the JSON API (an Angular/mobile/other frontend) or
// from the server-rendered website, so link.builder.js can put the right kind of link
// into whatever email/alert this request ends up triggering. Deliberately keyed on the URL
// prefix alone (not isApiRequest(), which also matches any XHR/JSON-accepting request):
// a small AJAX call made by a web page is still a web request.
export function linkContextMiddleware(req, res, next) {
  const target = req.originalUrl.startsWith("/api/") ? "frontend" : "web";
  runWithLinkContext({ target }, next);
}

export default { linkContextMiddleware };
