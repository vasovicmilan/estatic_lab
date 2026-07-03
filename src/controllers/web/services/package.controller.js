import * as packageService from "../../../services/package.service.js";
import { preparePackageListData, preparePackageDetailData } from "../../../presenters/catalog/package.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { logError } from "../../../utils/logger.util.js";

export async function packageList(req, res, next) {
  try {
    const { page = 1 } = req.query;
    const result = await packageService.findActivePackages({ page: parseInt(page, 10) || 1 });
    const viewData = preparePackageListData(result, req.query);
    const seo = await generateSeo("page", { title: "Paketi", description: "Kombinovani paketi usluga po povoljnijoj ceni.", slug: "/paketi" }, req);

    return res.render("our-services/packages", {
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
    const viewData = preparePackageDetailData(pkg);
    const seo = await generateSeo("page", { title: pkg.naziv, description: pkg.kratakOpis, slug: `/paketi/${pkg.slug}` }, req);

    return res.render("our-services/package-details", {
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