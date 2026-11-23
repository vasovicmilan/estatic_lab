import wheelService from "../../../services/wheel.service.js";
import { buildPageSeo } from "../../../seo/index.js";
import { BUSINESS } from "../../../config/business.config.js";
import { logError, logWarn } from "../../../utils/logger.util.js";

const SOURCE_PATTERN = /^[a-z0-9_-]{1,60}$/i;

// /tocak (podrazumevani točak) i /tocak/:slug (ostali)
export async function wheelPage(req, res, next) {
  try {
    const { wheel, prizes, isOpen } = await wheelService.getWheelConfig(req.params.slug);
    const source = typeof req.query.src === "string" && SOURCE_PATTERN.test(req.query.src) ? req.query.src : "";
    const title = wheel.title || "Zavrtite točak sreće";
    const description = wheel.intro || "Ostavite kontakt, zavrtite točak i osvojite popust ili besplatan tretman u Estetik Lab-u.";
    const path = req.params.slug && req.params.slug !== "tocak" ? `/tocak/${wheel.slug}` : "/tocak";
    return res.render("public/wheel", {
      pageTitle: `${title} | ${BUSINESS.name}`,
      pageDescription: description,
      // a campaign landing page for a QR code, not something search engines should list
      seo: buildPageSeo({ title, description, canonical: `${BUSINESS.siteUrl}${path}`, isIndexable: false }),
      data: { wheel, prizes, isOpen, title, description, source, csrfToken: res.locals.csrfToken, formData: {}, breadcrumbs: [] },
    });
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[wheelPage] Greška pri učitavanju točka", error);
    next(error);
  }
}

// JSON endpoint called by public/js/wheel.js. The prize and the number of turns are decided
// here; the page only plays the animation.
export async function spinWheel(req, res) {
  try {
    if (req.validationErrors) {
      logWarn("[spinWheel] Validacione greške", { validationErrors: req.validationErrors });
      return res.status(400).json({ success: false, message: "Proverite unete podatke.", errors: req.validationErrors });
    }
    const result = await wheelService.spin(req.body, { ip: req.ip, userAgent: req.headers["user-agent"] });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError("[spinWheel] Greška pri vrtenju točka", error);
    return res.status(500).json({ success: false, message: "Došlo je do greške. Pokušajte ponovo ili se javite osoblju na štandu." });
  }
}

export default { wheelPage, spinWheel };
