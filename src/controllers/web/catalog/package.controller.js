import * as packageService from "../../../services/package.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import { preparePackageListData, preparePackageDetailData } from "../../../presenters/catalog/package.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { buildItemListJsonLd } from "../../../seo/utils.seo.js";
import { logError } from "../../../utils/logger.util.js";

export async function packageList(req, res, next) {
  try {
    const { page = 1 } = req.query;
    // Fetches every active package (capped at pagination.util.js's own
    // MAX_LIMIT=100 - comfortably above the current catalog size; revisit
    // if the catalog ever grows past that) rather than a paginated DB slice.
    // Grouping (5/10-session tiers of the same service collapsing into one
    // card) has to happen across the WHOLE catalog before pagination, not
    // after - see preparePackageListData's own comment for why. Pagination
    // itself happens inside that presenter call, over the resulting groups
    // (display cards), using the real page number from the query string.
    const result = await packageService.findActivePackages({ page: 1, limit: 100 });
    const viewData = preparePackageListData(result.data, req.query, { page: parseInt(page, 10) || 1, perPage: 12 });
    const seo = await generateSeo("page", { title: "Paketi", description: "Kombinovani paketi usluga po povoljnijoj ceni.", slug: "/paketi" }, req);
    const itemList = buildItemListJsonLd(req, result.data.map((p) => ({ name: p.naziv, path: `/paketi/${p.slug}` })));
    if (itemList) seo.jsonLd = [...(seo.jsonLd || []), itemList];

    return res.render("services/packages", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[packageList] Greška pri učitavanju liste paketa", error, { page: req.query.page });
    next(error);
  }
}

export async function packageDetails(req, res, next) {
  try {
    const { slug } = req.params;
    const pkg = await packageService.getPackageBySlug(slug);
    const testimonials = await testimonialService.getApprovedTestimonials({ limit: 6, package: pkg.id });
    const ratingSummary = await testimonialService.getRatingSummary({ package: pkg.id });
    const viewData = preparePackageDetailData(pkg, { testimonials });
    pkg.recenzije = testimonials;
    pkg.ratingSummary = ratingSummary;
    const seo = await generateSeo("package", pkg, req);

    return res.render("services/package-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[packageDetails] Greška pri učitavanju detalja paketa", error, { slug: req.params.slug });
    next(error);
  }
}

export default { packageList, packageDetails };