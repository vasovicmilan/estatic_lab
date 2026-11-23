import employeeCardService from "../../../services/employee-card.service.js";
import { buildPageSeo } from "../../../seo/index.js";
import { BUSINESS } from "../../../config/business.config.js";
import { logError } from "../../../utils/logger.util.js";

const SLUG_PATTERN = /^[a-z0-9]{4,20}$/;

// Javna vizitka iza QR koda. Nije za pretraživače (noindex) - to je lična stranica, ne deo sadržaja sajta.
export async function cardPage(req, res, next) {
  try {
    if (!SLUG_PATTERN.test(req.params.slug)) return next();
    const card = await employeeCardService.getPublicCard(req.params.slug);
    const title = card.title ? `${card.name} - ${card.title}` : card.name;
    return res.render("public/employee-card", {
      pageTitle: `${title} | ${BUSINESS.name}`,
      pageDescription: `Vizitka: ${title}`,
      seo: buildPageSeo({ title, description: `Vizitka: ${title}`, canonical: card.url, isIndexable: false }),
      data: { card, breadcrumbs: [] },
    });
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[employeeCardPage] Greška pri učitavanju vizitke", error, { slug: req.params.slug });
    next(error);
  }
}

export async function cardVCard(req, res, next) {
  try {
    if (!SLUG_PATTERN.test(req.params.slug)) return next();
    const { text, fileName } = await employeeCardService.getVCard(req.params.slug);
    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(text);
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[employeeCardVCard] Greška pri generisanju vCard-a", error, { slug: req.params.slug });
    next(error);
  }
}

export default { cardPage, cardVCard };
