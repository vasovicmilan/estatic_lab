import * as serviceService from "../../../services/service.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as tagService from "../../../services/tag.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import { prepareServiceListData, prepareServiceCategoryData, prepareServiceTagData, prepareServiceDetailData } from "../../../presenters/catalog/service.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { buildItemListJsonLd } from "../../../seo/utils.seo.js";
import { logError } from "../../../utils/logger.util.js";

export async function serviceList(req, res, next) {
  try {
    const { page = 1 } = req.query;

    const [result, categoriesRaw, tags, totalCount] = await Promise.all([
      serviceService.findActiveServices({ page: parseInt(page, 10) || 1 }),
      categoryService.getPublicCategories("service"),
      tagService.getPublicTags("service"),
      serviceService.countAllActiveServices(),
    ]);
    const categories = await serviceService.attachServiceCountsToCategories(categoriesRaw);

    const viewData = prepareServiceListData(result, { query: req.query, categories, tags, totalCount });
    const seo = await generateSeo("page", { title: "Usluge", description: "Pregledajte sve usluge Estetik Lab wellness centra.", slug: "/usluge" }, req);
    const itemList = buildItemListJsonLd(req, result.data.map((s) => ({ name: s.naziv, path: `/usluge/${s.slug}` })));
    if (itemList) seo.jsonLd = [...(seo.jsonLd || []), itemList];

    return res.render("services/services", {
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

import { renderContentBlocks } from "../../../utils/content-blocks.util.js";

export async function serviceCategory(req, res, next) {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;

    const [category, categoriesRaw, tags, totalCount] = await Promise.all([
      categoryService.getCategoryBySlugAndDomain(categorySlug, "service"),
      categoryService.getPublicCategories("service"),
      tagService.getPublicTags("service"),
      serviceService.countAllActiveServices(),
    ]);
    const categories = await serviceService.attachServiceCountsToCategories(categoriesRaw);
    const categoryIds = await categoryService.getCategoryAndDescendantIds(category._id, "service");
    const result = await serviceService.findActiveServices({ page: parseInt(page, 10) || 1, filters: { category: categoryIds } });

    const viewData = prepareServiceCategoryData(
      {
        id: category._id.toString(),
        naziv: category.name,
        slug: category.slug,
        description: category.shortDescription || "",
        contentBlocks: renderContentBlocks(category.content),
      },
      result,
      req.query,
      { categories, tags, totalCount }
    );
    const seo = await generateSeo("category", category, req);
    const itemList = buildItemListJsonLd(req, result.data.map((s) => ({ name: s.naziv, path: `/usluge/${s.slug}` })));
    if (itemList) seo.jsonLd = [...(seo.jsonLd || []), itemList];

    return res.render("services/services", {
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

export async function serviceTag(req, res, next) {
  try {
    const { tagSlug } = req.params;
    const { page = 1 } = req.query;

    const [tag, categoriesRaw, tags, totalCount] = await Promise.all([
      tagService.getTagBySlugAndDomain(tagSlug, "service"),
      categoryService.getPublicCategories("service"),
      tagService.getPublicTags("service"),
      serviceService.countAllActiveServices(),
    ]);
    const categories = await serviceService.attachServiceCountsToCategories(categoriesRaw);
    const result = await serviceService.findActiveServices({ page: parseInt(page, 10) || 1, filters: { tag: tag._id } });

    const viewData = prepareServiceTagData({ id: tag._id.toString(), naziv: tag.name, slug: tag.slug, description: tag.description || "" }, result, req.query, { categories, tags, totalCount });
    const seo = await generateSeo("page", { title: tag.name, description: `Usluge sa tagom ${tag.name}.`, slug: `/usluge/tag/${tag.slug}` }, req);
    const itemList = buildItemListJsonLd(req, result.data.map((s) => ({ name: s.naziv, path: `/usluge/${s.slug}` })));
    if (itemList) seo.jsonLd = [...(seo.jsonLd || []), itemList];

    return res.render("services/services", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[serviceTag] Greška pri učitavanju taga usluga", error, { tagSlug: req.params.tagSlug });
    next(error);
  }
}

export async function serviceDetails(req, res, next) {
  try {
    const { slug } = req.params;

    const service = await serviceService.getServiceBySlug(slug);
    const testimonials = await testimonialService.getApprovedTestimonials({ limit: 6, service: service.id });
    const ratingSummary = await testimonialService.getRatingSummary({ service: service.id });

    const viewData = prepareServiceDetailData(service, { relatedProducts: service.povezaniProizvodi || [], testimonials });
    service.recenzije = testimonials;
    service.ratingSummary = ratingSummary;
    const seo = await generateSeo("service", service, req);

    return res.render("services/service-details", {
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

export default { serviceList, serviceCategory, serviceTag, serviceDetails };