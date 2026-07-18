import * as productService from "../../../services/product.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as tagService from "../../../services/tag.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import * as postService from "../../../services/post.service.js";
import {
  prepareProductListData,
  prepareProductCategoryData,
  prepareProductTagData,
  prepareProductDetailData,
} from "../../../presenters/catalog/product.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { logError } from "../../../utils/logger.util.js";

export async function productList(req, res, next) {
  try {
    const { page = 1, search = "" } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const isLandingView = pageNum === 1 && !search;

    const [result, categories, tags, featuredResult, saleResult, latestPostsResult] = await Promise.all([
      productService.listPublicProducts({ page: pageNum, search }),
      categoryService.getPublicCategories("product"),
      tagService.getPublicTags("product"),
      isLandingView ? productService.listPublicProducts({ filters: { badge: "featured" }, limit: 4 }) : null,
      isLandingView ? productService.listPublicProducts({ filters: { badge: "sale" }, limit: 4 }) : null,
      isLandingView ? postService.findPublishedPosts({ limit: 3 }) : null,
    ]);

    const viewData = prepareProductListData(result, {
      query: req.query,
      categories,
      tags,
      featured: featuredResult?.data || [],
      sale: saleResult?.data || [],
      latestPosts: latestPostsResult?.data || [],
      isLandingView,
    });
    const seo = await generateSeo("page", { title: "Prodavnica", description: "Oprema, delovi i potrošni materijal za profesionalnu kozmetičku negu.", slug: "/prodavnica" }, req);

    return res.render("shop/products", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[productList] Greška pri učitavanju liste proizvoda", error, { page: req.query.page });
    next(error);
  }
}

export async function productCategory(req, res, next) {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;

    const [category, categories, tags] = await Promise.all([
      categoryService.getCategoryBySlugAndDomain(categorySlug, "product"),
      categoryService.getPublicCategories("product"),
      tagService.getPublicTags("product"),
    ]);
    const result = await productService.listPublicProducts({ page: parseInt(page, 10) || 1, filters: { category: category._id } });

    const viewData = prepareProductCategoryData(
      { id: category._id.toString(), naziv: category.name, slug: category.slug },
      result,
      req.query,
      { categories, tags }
    );
    const seo = await generateSeo("category", category, req);

    return res.render("shop/products", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[productCategory] Greška pri učitavanju kategorije proizvoda", error, { categorySlug: req.params.categorySlug });
    next(error);
  }
}

export async function productTag(req, res, next) {
  try {
    const { tagSlug } = req.params;
    const { page = 1 } = req.query;

    const [tag, categories, tags] = await Promise.all([
      tagService.getTagBySlugAndDomain(tagSlug, "product"),
      categoryService.getPublicCategories("product"),
      tagService.getPublicTags("product"),
    ]);
    const result = await productService.listPublicProducts({ page: parseInt(page, 10) || 1, filters: { tag: tag._id } });

    const viewData = prepareProductTagData(
      { id: tag._id.toString(), naziv: tag.name, slug: tag.slug },
      result,
      req.query,
      { categories, tags }
    );
    const seo = await generateSeo("tag", tag, req);

    return res.render("shop/products", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[productTag] Greška pri učitavanju taga proizvoda", error, { tagSlug: req.params.tagSlug });
    next(error);
  }
}

export async function productDetails(req, res, next) {
  try {
    const { slug } = req.params;

    const product = await productService.getPublicProductBySlug(slug);
    const testimonials = await testimonialService.getApprovedTestimonials({ product: product.id, limit: 10 });

    const viewData = prepareProductDetailData(product, {
      relatedProducts: product.povezaniProizvodi || [],
      testimonials,
    });
    const seo = await generateSeo("product", product, req);

    return res.render("shop/product-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[productDetails] Greška pri učitavanju detalja proizvoda", error, { slug: req.params.slug });
    next(error);
  }
}

export default { productList, productCategory, productTag, productDetails };