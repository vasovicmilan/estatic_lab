import { resolvePublicLimit } from "../../../utils/pagination.util.js";
import * as packageService from "../../../services/package.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import * as categoryService from "../../../services/category.service.js";
import { preparePackageListData, preparePackageDetailData, attachPackageCountsToCategories, countPackageGroups } from "../../../presenters/catalog/package.presenter.js";
import siteContentService from "../../../services/site-content.service.js";
import { generateSeo } from "../../../seo/index.js";
import { buildItemListJsonLd } from "../../../seo/utils.seo.js";
import { logError } from "../../../utils/logger.util.js";

async function renderPackageList(req, res, next, categorySlug = null) {
  try {
    const { page = 1 } = req.query;
    // Fetches every active package (page by page, no fixed cap) rather than a paginated DB slice.
    // Grouping (5/10-session tiers of the same service collapsing into one
    // card) has to happen across the WHOLE catalog before pagination, not
    // after - see preparePackageListData's own comment for why. Pagination
    // itself happens inside that presenter call, over the resulting groups
    // (display cards), using the real page number from the query string.
    // The category filter and the per-category counts are applied in memory
    // for the same reason (a category can't be filtered in the DB without
    // splitting tier groups across pages).
    const [result, categoriesRaw, categoryDoc] = await Promise.all([
      packageService.findAllActivePackages(),
      categoryService.getPublicCategories("service"),
      categorySlug ? categoryService.getCategoryBySlugAndDomain(categorySlug, "service") : Promise.resolve(null),
    ]);

    let packages = result.data;
    let category = null;
    if (categoryDoc) {
      const ids = new Set((await categoryService.getCategoryAndDescendantIds(categoryDoc._id, "service")).map((id) => id.toString()));
      packages = packages.filter((p) => (p.kategorije || []).some((id) => ids.has(id)));
      category = { id: categoryDoc._id.toString(), naziv: categoryDoc.name, slug: categoryDoc.slug, description: categoryDoc.shortDescription || "" };
    }

    const categories = attachPackageCountsToCategories(categoriesRaw, result.data, category?.id);
    const totalCount = countPackageGroups(result.data);
    const intro = category ? null : await siteContentService.getPackagesIntro();
    const viewData = preparePackageListData(packages, req.query, {
      page: parseInt(page, 10) || 1,
      perPage: resolvePublicLimit(req.query.limit, 12),
      intro,
      category,
      categories,
      totalCount,
    });

    let seo;
    if (category) {
      seo = await generateSeo(
        "page",
        {
          title: `${category.naziv} - paketi`,
          description: category.description || `Paketi tretmana iz kategorije ${category.naziv}.`,
          slug: `/paketi/kategorija/${category.slug}`,
          noIndex: packages.length === 0,
        },
        req
      );
    } else {
      const pageSeo = await siteContentService.getPageSeoConfig("packages");
      seo = await generateSeo("page", { title: pageSeo.title, description: pageSeo.description, slug: pageSeo.path, noIndex: pageSeo.noIndex }, req);
    }
    const itemList = buildItemListJsonLd(req, packages.map((p) => ({ name: p.naziv, path: `/paketi/${p.slug}` })));
    if (itemList) seo.jsonLd = [...(seo.jsonLd || []), itemList];

    return res.render("services/packages", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[packageList] Greška pri učitavanju liste paketa", error, { page: req.query.page, categorySlug });
    next(error);
  }
}

export function packageList(req, res, next) {
  return renderPackageList(req, res, next);
}

export function packageCategory(req, res, next) {
  return renderPackageList(req, res, next, req.params.categorySlug);
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

export default { packageList, packageCategory, packageDetails };