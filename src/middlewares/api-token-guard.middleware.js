import { AppError } from "../utils/error.util.js";
import auditLogService from "../services/audit-log.service.js";

// Drugi sloj odbrane za API tokene (prvi je presek dozvola role i oblasti tokena).
// ALLOWLIST: token sme samo rute navedene ovde, sve ostalo je 403, pa nova admin ruta koja se doda
// u budućnosti nije automatski dostupna tokenu. Putanje su relativne na /api/v1/admin.
//
// draft:
//   "post"   -> status se prinudno postavlja na "draft" (bez zakazivanja); izmena objavljenog posta ga skida sa sajta
//   "active" -> isActive se prinudno postavlja na false; izmena aktivne usluge/paketa/proizvoda/materijala je skida sa sajta
//   "taxonomy-create" -> nova kategorija/tag se pravi NEAKTIVNA (isActive=false)
//   "taxonomy-edit"   -> izmena ne sme da menja aktivnost, prioritet, domen ni roditelja (ne skida kategoriju sa sajta
//                        i ne seli je po strukturi); ostala polja (naziv, opis, SEO...) se menjaju odmah i vide se u logu
// Vlasnik pregleda i vraća (objavi / aktivira) iz admin panela.
const SEG = "[^/]+";
const RULES = [
  // ---- blog ----
  { scope: "blog", methods: ["GET"], re: new RegExp(`^/posts(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "blog", methods: ["POST"], re: /^\/posts$/, draft: "post" },
  { scope: "blog", methods: ["PUT"], re: new RegExp(`^/posts/${SEG}$`), draft: "post" },
  { scope: "blog", methods: ["POST"], re: /^\/uploads\/posts(?:\/gallery)?$/ },
  { scope: "blog", methods: ["GET"], re: new RegExp(`^/(?:categories|tags)(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "blog", methods: ["POST"], re: /^\/(?:categories|tags)$/, draft: "taxonomy-create" },
  { scope: "blog", methods: ["PUT"], re: new RegExp(`^/(?:categories|tags)/${SEG}$`), draft: "taxonomy-edit" },

  // ---- katalog ----
  { scope: "catalog", methods: ["GET"], re: new RegExp(`^/(?:services|packages|products)(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "catalog", methods: ["POST"], re: /^\/(?:services|packages|products)$/, draft: "active" },
  { scope: "catalog", methods: ["PUT"], re: new RegExp(`^/(?:services|packages|products)/${SEG}$`), draft: "active" },
  { scope: "catalog", methods: ["POST"], re: /^\/uploads\/(?:services|packages|products)(?:\/gallery)?$/ },
  { scope: "catalog", methods: ["GET"], re: new RegExp(`^/(?:categories|tags|resources)(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "catalog", methods: ["POST"], re: /^\/(?:categories|tags)$/, draft: "taxonomy-create" },
  { scope: "catalog", methods: ["PUT"], re: new RegExp(`^/(?:categories|tags)/${SEG}$`), draft: "taxonomy-edit" },

  // ---- materijali (PDF, katalozi, brošure) ----
  { scope: "materials", methods: ["GET"], re: new RegExp(`^/materials(?:/${SEG}(?:/edit)?)?$`) },
  { scope: "materials", methods: ["POST"], re: /^\/materials$/, draft: "active" },
  { scope: "materials", methods: ["PUT"], re: new RegExp(`^/materials/${SEG}$`), draft: "active" },

  // ---- tekstovi sajta (pocetna, o nama, FAQ, partnerski program, zasto mi) ----
  // Nemaju koncept nacrta: izmena je ODMAH javna (vlasnik je ima u dnevniku revizije sa starom i novom
  // vrednošću). Pravne stranice (politika privatnosti, uslovi korišćenja) nisu na listi namerno.
  { scope: "site", methods: ["GET"], re: /^\/site-content$/ },
  { scope: "site", methods: ["PUT"], re: /^\/site-content\/(?:o-nama|faq|partnerski-program|pocetna-uvod|zasto-mi|pocetna-hero|usluge-uvod|paketi-uvod|prodavnica-uvod|blog-uvod|kontakt|seo-stranica|tim-uvod)$/ },
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
  // ista ruta može da stoji u više oblasti (npr. čitanje kategorija u blogu i katalogu): važi ako token ima BILO KOJU
  const matches = RULES.filter((r) => r.methods.includes(req.method) && r.re.test(req.path));
  if (matches.length === 0) return next(deny(req, "Token nema pravo na ovu akciju.", "route-not-allowed"));
  const rule = matches.find((r) => scopes.includes(r.scope));
  if (!rule) return next(deny(req, "Token nema pravo na ovu oblast.", `scope-missing:${matches.map((m) => m.scope).join("|")}`));

  // multipart zahtevi (materijali) još nemaju parsiran body u ovom trenutku, pa kontroler
  // čita ovu oznaku i sam prinudi nacrt
  if (rule.draft) req.apiTokenDraft = rule.draft;

  // asistentu se podrazumevano nude samo AKTIVNE kategorije (neaktivne ne treba da dodeljuje uslugama i objavama);
  // svoje nacrte vidi tek kad izričito traži ?isActive=false
  if (req.method === "GET" && /^\/categories\/?$/.test(req.path) && req.query?.isActive === undefined) {
    Object.defineProperty(req, "query", { value: { ...req.query, isActive: "true" }, writable: true, configurable: true });
  }

  if (rule.draft && req.body && typeof req.body === "object") {
    if (rule.draft === "post") {
      req.body.status = "draft";
      delete req.body.scheduledFor;
    } else if (rule.draft === "taxonomy-edit") {
      for (const field of ["isActive", "priority", "domain", "parent"]) delete req.body[field];
    } else {
      req.body.isActive = false;
    }
  }
  next();
}

export { RULES as API_TOKEN_RULES };
export default apiTokenGuard;
