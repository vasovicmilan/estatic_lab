import materialService from "../../../services/material.service.js";
import { buildPageSeo } from "../../../seo/index.js";
import { BUSINESS } from "../../../config/business.config.js";
import { logError } from "../../../utils/logger.util.js";

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

// Landing page behind a material's QR code / newsletter button: title, description and a
// download button. Not something search engines should list.
export async function materialPage(req, res, next) {
  try {
    if (!SLUG_PATTERN.test(req.params.slug)) return next();
    const material = await materialService.getPublicMaterial(req.params.slug);
    const description = material.opis || `Preuzmite materijal: ${material.naslov}`;
    return res.render("public/material", {
      pageTitle: `${material.naslov} | ${BUSINESS.name}`,
      pageDescription: description,
      seo: buildPageSeo({ title: material.naslov, description, canonical: `${BUSINESS.siteUrl}/materijali/${material.slug}`, isIndexable: false }),
      data: { material, breadcrumbs: [] },
    });
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[materialPage] Greška pri učitavanju materijala", error, { slug: req.params.slug });
    next(error);
  }
}

// the file itself - counted as a download
export async function materialDownload(req, res, next) {
  try {
    if (!SLUG_PATTERN.test(req.params.slug)) return next();
    const { filePath, downloadName } = await materialService.getMaterialDownload(req.params.slug);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.download(filePath, downloadName, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[materialDownload] Greška pri preuzimanju materijala", error, { slug: req.params.slug });
    next(error);
  }
}

// inline preview, images only (a PDF/Office file is only ever offered as a download)
export async function materialPreview(req, res, next) {
  try {
    if (!SLUG_PATTERN.test(req.params.slug)) return next();
    const { filePath, mimeType } = await materialService.getMaterialDownload(req.params.slug, { count: false });
    if (!/^image\//.test(mimeType)) return next();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", mimeType);
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    if (error.statusCode === 404) return next();
    logError("[materialPreview] Greška pri prikazu materijala", error, { slug: req.params.slug });
    next(error);
  }
}

export default { materialPage, materialDownload, materialPreview };
