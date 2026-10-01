import siteContentService from "../../../../services/site-content.service.js";
import {
  findSectionBySlug,
  prepareSiteContentIndexData,
  prepareSiteContentFormData,
} from "../../../../presenters/admin/marketing/site-content.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { PAGE_SEO_PAGES } from "../../../../config/site-content-defaults.js";

const INDEX_TITLE = "Tekstovi sajta";
const INDEX_DESCRIPTION = "Uređivanje tekstova na javnim stranicama sajta";

// section.key -> ime funkcije u site-content servisu i audit akcija
// (ista imena kao u API kontroleru - controllers/api/v1/admin-ops.controller.js,
// da audit log ostane jedinstven bez obzira odakle je izmena došla)
const SECTION_ACTIONS = {
  about: { update: "updateAbout", audit: "SITE_CONTENT_ABOUT_UPDATED" },
  faq: { update: "updateFaq", audit: "SITE_CONTENT_FAQ_UPDATED" },
  privacyPolicy: { update: "updatePrivacyPolicy", audit: "SITE_CONTENT_PRIVACY_POLICY_UPDATED" },
  termsAndConditions: { update: "updateTermsAndConditions", audit: "SITE_CONTENT_TERMS_UPDATED" },
  partnership: { update: "updatePartnership", audit: "SITE_CONTENT_PARTNERSHIP_UPDATED" },
  homeIntro: { update: "updateHomeIntro", audit: "SITE_CONTENT_HOME_INTRO_UPDATED" },
  whyUs: { update: "updateWhyUs", audit: "SITE_CONTENT_WHY_US_UPDATED" },
  teamIntro: { update: "updateTeamIntro", audit: "SITE_CONTENT_TEAM_INTRO_UPDATED" },
  homeHero: { update: "updateHomeHero", audit: "SITE_CONTENT_HOME_HERO_UPDATED" },
  servicesIntro: { update: "updateServicesIntro", audit: "SITE_CONTENT_SERVICES_INTRO_UPDATED" },
  packagesIntro: { update: "updatePackagesIntro", audit: "SITE_CONTENT_PACKAGES_INTRO_UPDATED" },
  shopIntro: { update: "updateShopIntro", audit: "SITE_CONTENT_SHOP_INTRO_UPDATED" },
  blogIntro: { update: "updateBlogIntro", audit: "SITE_CONTENT_BLOG_INTRO_UPDATED" },
  contactPage: { update: "updateContactPage", audit: "SITE_CONTENT_CONTACT_PAGE_UPDATED" },
  pageSeo: { update: "updatePageSeo", audit: "SITE_CONTENT_PAGE_SEO_UPDATED" },
};

// ---- normalizacija req.body -> ono što servis očekuje ------------------------

const str = (value) => (typeof value === "string" ? value.trim() : "");

/** Izvlači niz iz polja koje je klijent poslao kao JSON string (ili već parsirano). */
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Textarea "jedan red = jedna stavka" -> niz nepraznih stringova. */
function splitLines(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Niz objekata sa fiksnim poljima; potpuno prazni redovi se odbacuju. */
function cleanItems(value, fieldNames) {
  return asArray(value)
    .filter((row) => row && typeof row === "object")
    .map((row) => Object.fromEntries(fieldNames.map((name) => [name, str(row[name])])))
    .filter((row) => fieldNames.some((name) => row[name] !== ""));
}

function cleanSection(section, allowSubsections) {
  if (!section || typeof section !== "object") return null;

  const cleaned = { title: str(section.title) };
  const paragraphs = splitLines(section.paragraphs);
  const list = splitLines(section.list);
  const closingParagraphs = splitLines(section.closingParagraphs);
  if (paragraphs.length) cleaned.paragraphs = paragraphs;
  if (list.length) cleaned.list = list;
  if (closingParagraphs.length) cleaned.closingParagraphs = closingParagraphs;

  if (allowSubsections) {
    const subsections = asArray(section.subsections)
      .map((sub) => cleanSection(sub, false))
      .filter(Boolean);
    if (subsections.length) cleaned.subsections = subsections;
  }

  const isEmpty = !cleaned.title && !cleaned.paragraphs && !cleaned.list && !cleaned.closingParagraphs && !cleaned.subsections;
  return isEmpty ? null : cleaned;
}

function cleanSections(value) {
  return asArray(value)
    .map((section) => cleanSection(section, true))
    .filter(Boolean);
}

/**
 * Pretvara req.body u objekat u obliku u kome ga očekuje odgovarajući
 * siteContentService.updateXxx (i u kome ga čuva Mongo). Isti oblik se koristi
 * i za ponovni prikaz forme posle greške, da admin ne izgubi šta je uneo.
 */
export function buildSectionPayload(sectionKey, body) {
  switch (sectionKey) {
    case "about":
      return { intro: str(body.intro), sections: cleanSections(body.sections) };
    case "faq":
      return { items: cleanItems(body.items, ["pitanje", "odgovor"]) };
    case "privacyPolicy":
    case "termsAndConditions":
      return { lastUpdated: str(body.lastUpdated), intro: str(body.intro), sections: cleanSections(body.sections) };
    case "partnership":
      return {
        intro: str(body.intro),
        // redni broj se uvek izvodi iz redosleda - nema smisla da ga admin ručno ukucava
        steps: cleanItems(body.steps, ["title", "description"]).map((step, index) => ({ number: index + 1, ...step })),
        highlights: splitLines(body.highlights),
      };
    case "homeIntro":
      return {
        title: str(body.title),
        lead: str(body.lead),
        who: str(body.who),
        massages: cleanItems(body.massages, ["title", "text", "href"]),
        packages: str(body.packages),
        closing: str(body.closing),
      };
    case "whyUs":
      return cleanItems(body.whyUs, ["icon", "title", "text"]);
    case "teamIntro":
      return {
        eyebrow: str(body.eyebrow),
        title: str(body.title),
        lead: str(body.lead),
        highlights: cleanItems(body.highlights, ["icon", "title", "text"]),
      };
    case "servicesIntro":
    case "packagesIntro":
    case "blogIntro":
      return {
        eyebrow: str(body.eyebrow),
        title: str(body.title),
        lead: str(body.lead),
        paragraphs: splitLines(body.paragraphs),
        highlights: cleanItems(body.highlights, ["icon", "title", "text"]),
      };
    case "shopIntro":
      return {
        eyebrow: str(body.eyebrow),
        title: str(body.title),
        lead: str(body.lead),
        paragraphs: splitLines(body.paragraphs),
        trust: cleanItems(body.trust, ["icon", "title", "text"]),
        faq: cleanItems(body.faq, ["pitanje", "odgovor"]),
      };
    case "homeHero":
      return Object.fromEntries(["eyebrow", "title", "subtitle", "ctaLabel", "ctaUrl", "secondaryCtaLabel", "secondaryCtaUrl"].map((k) => [k, str(body[k])]));
    case "contactPage":
      return Object.fromEntries(["eyebrow", "title", "lead", "mapAddress", "mapEmbedUrl", "googleDataNotice"].map((k) => [k, str(body[k])]));
    case "pageSeo":
      // polja su `${stranica}__title` / `${stranica}__description` (vidi presenter)
      return Object.fromEntries(
        Object.keys(PAGE_SEO_PAGES).filter((key) => siteContentService.isPageAvailable(key)).map((key) => [key, { title: str(body[`${key}__title`]), description: str(body[`${key}__description`]) }])
      );
    default:
      return {};
  }
}

// ---- kontroleri --------------------------------------------------------------

export async function siteContentIndex(req, res, next) {
  try {
    const content = await siteContentService.getSiteContent();
    return res.render("admin/marketing/site-content-index", {
      pageTitle: INDEX_TITLE,
      pageDescription: INDEX_DESCRIPTION,
      data: prepareSiteContentIndexData(content),
    });
  } catch (error) {
    logError("[siteContentIndex] Greška pri učitavanju tekstova sajta", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function siteContentForm(req, res, next) {
  try {
    const section = findSectionBySlug(req.params.section);
    if (!section) return next();

    const content = await siteContentService.getSiteContent();
    return res.render("admin/marketing/site-content", {
      pageTitle: section.title,
      pageDescription: section.description,
      data: { ...prepareSiteContentFormData(section.key, content[section.key]), errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[siteContentForm] Greška pri učitavanju forme", error, { userId: req.session?.user?.id, section: req.params.section });
    next(error);
  }
}

export async function updateSiteContent(req, res, next) {
  const section = findSectionBySlug(req.params.section);
  if (!section) return next();

  const payload = buildSectionPayload(section.key, req.body);

  try {
    const actions = SECTION_ACTIONS[section.key];
    // whyUs servis prima direktno niz, ostali objekat
    const updated = await siteContentService[actions.update](payload);

    logInfo(`[updateSiteContent:${section.key}] Sadržaj ažuriran`, { adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: actions.audit,
      entity: { type: "SiteContent", id: "singleton" },
      changes: { [section.key]: { after: updated } },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", `„${section.title}“ je uspešno ažurirano`, "/admin/sajt/sadrzaj");
  } catch (error) {
    logError(`[updateSiteContent:${section.key}] Greška pri ažuriranju`, error, { userId: req.session?.user?.id });

    if (error.statusCode) {
      // Ponovo prikazujemo ono što je admin poslao (ne ono iz baze), da ništa ne izgubi
      return res.status(error.statusCode).render("admin/marketing/site-content", {
        pageTitle: section.title,
        pageDescription: section.description,
        data: {
          ...prepareSiteContentFormData(section.key, payload),
          errors: { general: error.message },
          csrfToken: res.locals.csrfToken,
        },
      });
    }
    next(error);
  }
}

export default { siteContentIndex, siteContentForm, updateSiteContent, buildSectionPayload };
