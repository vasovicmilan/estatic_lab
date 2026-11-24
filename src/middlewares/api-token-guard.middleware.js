import { AppError } from "../utils/error.util.js";
import auditLogService from "../services/audit-log.service.js";

// Drugi sloj odbrane za API tokene (prvi je presek dozvola role i oblasti tokena).
// ALLOWLIST: token sme samo rute navedene ovde, sve ostalo je 403, pa nova admin ruta koja se doda
// u budućnosti nije automatski dostupna tokenu. Putanje su relativne na /api/v1/admin.
//
// draft:
//   "post"   -> status se prinudno postavlja na "draft" (bez zakazivanja); izmena objavljenog posta ga skida sa sajta
//   "active" -> isActive se prinudno postavlja na false; izmena aktivne usluge/paketa/proizvoda/materijala je skida sa sajta
// Vlasnik pregleda i vraća (objavi / aktivira) iz admin panela.
const SEG = "[^/]+";
const RULES = [
  // ---- blog ----
  { scope: "blog", methods: ["GET"], re: new RegExp(`^/posts(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "blog", methods: ["POST"], re: /^\/posts$/, draft: "post" },
  { scope: "blog", methods: ["PUT"], re: new RegExp(`^/posts/${SEG}$`), draft: "post" },
  { scope: "blog", methods: ["POST"], re: /^\/uploads\/posts(?:\/gallery)?$/ },
  { scope: "blog", methods: ["GET"], re: new RegExp(`^/(?:categories|tags)(?:/${SEG}(?:/edit)?)?$`) },

  // ---- katalog ----
  { scope: "catalog", methods: ["GET"], re: new RegExp(`^/(?:services|packages|products)(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "catalog", methods: ["POST"], re: /^\/(?:services|packages|products)$/, draft: "active" },
  { scope: "catalog", methods: ["PUT"], re: new RegExp(`^/(?:services|packages|products)/${SEG}$`), draft: "active" },
  { scope: "catalog", methods: ["POST"], re: /^\/uploads\/(?:services|packages|products)(?:\/gallery)?$/ },
  { scope: "catalog", methods: ["GET"], re: new RegExp(`^/(?:categories|tags|resources)(?:/${SEG}(?:/edit)?)?$`) },

  // ---- materijali (PDF, katalozi, brošure) ----
  { scope: "materials", methods: ["GET"], re: new RegExp(`^/materials(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "materials", methods: ["POST"], re: /^\/materials$/, draft: "active" },
  { scope: "materials", methods: ["PUT"], re: new RegExp(`^/materials/${SEG}$`), draft: "active" },
];

function deny(req, message, reason) {
  auditLogService.recordAuditLog({
    actor: req.user,
    action: "API_TOKEN_DENIED",
    entity: { type: "Route", id: null },
    changes: { method: { old: null, new: req.method }, path: { old: null, new: req.originalUrl }, reason: { old: null, new: reason } },
    req,
    success: false,
    errorMessage: message,
  });
  return new AppError(message, 403, { name: "AuthorizationError" });
}

export function apiTokenGuard(req, res, next) {
  if (req.user?.via !== "api-token") return next();

  const scopes = req.user.scopes || [];
  const rule = RULES.find((r) => r.methods.includes(req.method) && r.re.test(req.path));

  if (!rule) return next(deny(req, "Token nema pravo na ovu akciju.", "route-not-allowed"));
  if (!scopes.includes(rule.scope)) return next(deny(req, "Token nema pravo na ovu oblast.", `scope-missing:${rule.scope}`));

  // multipart zahtevi (materijali) još nemaju parsiran body u ovom trenutku, pa kontroler
  // čita ovu oznaku i sam prinudi nacrt
  if (rule.draft) req.apiTokenDraft = rule.draft;

  if (rule.draft && req.body && typeof req.body === "object") {
    if (rule.draft === "post") {
      req.body.status = "draft";
      delete req.body.scheduledFor;
    } else {
      req.body.isActive = false;
    }
  }
  next();
}

export { RULES as API_TOKEN_RULES };
export default apiTokenGuard;
