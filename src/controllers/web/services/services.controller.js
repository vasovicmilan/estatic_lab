import * as serviceService from "../../../services/service.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import { prepareServiceListData, prepareServiceCategoryData, prepareServiceDetailData } from "../../../presenters/catalog/service.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { logError } from "../../../utils/logger.util.js";

export async function serviceList(req, res, next) {
  try {
    const { page = 1 } = req.query;

    const [result, categories] = await Promise.all([
      serviceService.findActiveServices({ page: parseInt(page, 10) || 1 }),
      categoryService.getPublicCategories("service"),
    ]);

    const viewData = prepareServiceListData(result, { query: req.query, categories });
    const seo = await generateSeo("page", { title: "Usluge", description: "Pregledajte sve usluge Estatic Lab wellness centra.", slug: "/usluge" }, req);

    return res.render("our-services/our-services", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[serviceList] Greška pri učitavanju liste usluga", error, { page: req.query.page });
    next(error);
  }
}

export async function serviceCategory(req, res, next) {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;

    const category = await categoryService.getCategoryBySlugAndDomain(categorySlug, "service");
    const result = await serviceService.findActiveServices({ page: parseInt(page, 10) || 1, filters: { category: category._id } });

    const viewData = prepareServiceCategoryData({ id: category._id.toString(), naziv: category.name, slug: category.slug }, result, req.query);
    const seo = await generateSeo("category", category, req);

    return res.render("our-services/our-services", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[serviceCategory] Greška pri učitavanju kategorije usluga", error, { categorySlug: req.params.categorySlug });
    next(error);
  }
}

export async function serviceDetails(req, res, next) {
  try {
    const { slug } = req.params;

    const service = await serviceService.getServiceBySlug(slug);
    const testimonials = await testimonialService.getApprovedTestimonials({ limit: 6 });

    const viewData = prepareServiceDetailData(service, { testimonials });
    const seo = await generateSeo("service", service, req);

    return res.render("our-services/our-service-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[serviceDetails] Greška pri učitavanju detalja usluge", error, { slug: req.params.slug });
    next(error);
  }
}

export default { serviceList, serviceCategory, serviceDetails };