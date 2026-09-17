import * as serviceService from "../../../services/service.service.js";
import * as packageService from "../../../services/package.service.js";
import * as productService from "../../../services/product.service.js";
import * as expertService from "../../../services/expert.service.js";
import * as postService from "../../../services/post.service.js";
import * as businessPartnerService from "../../../services/business-partner.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as tagService from "../../../services/tag.service.js";
import { logError } from "../../../utils/logger.util.js";

// Every function below calls the exact same service-layer functions the public web
// pages call (controllers/web/catalog/*, controllers/web/public/*,
// controllers/web/blog/*) - the services already return mapped, presentation-safe
// data (see mapServiceForPublicDetail etc.), so there's nothing left to do here but
// shape the pagination envelope and res.json() it. No SEO/JSON-LD/breadcrumb/
// pagination-HTML-label concerns - those are presenter/view-only and don't belong
// in a JSON response.

function paginationMeta(result) {
  return { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages };
}

// ---- Services ----

export async function listServices(req, res, next) {
  try {
    const { category, tag, page = 1 } = req.query;
    const filters = {};

    if (category) {
      const categoryDoc = await categoryService.getCategoryBySlugAndDomain(category, "service");
      filters.category = await categoryService.getCategoryAndDescendantIds(categoryDoc._id, "service");
    }
    if (tag) {
      const tagDoc = await tagService.getTagBySlugAndDomain(tag, "service");
      filters.tag = tagDoc._id;
    }

    const result = await serviceService.findActiveServices({ page: parseInt(page, 10) || 1, filters });
    return res.json({ success: true, data: result.data, meta: paginationMeta(result) });
  } catch (error) {
    logError("[api/listServices] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getService(req, res, next) {
  try {
    const service = await serviceService.getServiceBySlug(req.params.slug);
    return res.json({ success: true, data: service });
  } catch (error) {
    logError("[api/getService] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Packages ----

export async function listPackages(req, res, next) {
  try {
    const { page = 1 } = req.query;
    const result = await packageService.findActivePackages({ page: parseInt(page, 10) || 1, limit: 100 });
    return res.json({ success: true, data: result.data, meta: paginationMeta(result) });
  } catch (error) {
    logError("[api/listPackages] Greška", error);
    next(error);
  }
}

export async function getPackage(req, res, next) {
  try {
    const pkg = await packageService.getPackageBySlug(req.params.slug);
    return res.json({ success: true, data: pkg });
  } catch (error) {
    logError("[api/getPackage] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Products ----

export async function listProducts(req, res, next) {
  try {
    const { category, tag, search, page = 1 } = req.query;
    const filters = {};

    if (category) {
      const categoryDoc = await categoryService.getCategoryBySlugAndDomain(category, "product");
      filters.category = await categoryService.getCategoryAndDescendantIds(categoryDoc._id, "product");
    }
    if (tag) {
      const tagDoc = await tagService.getTagBySlugAndDomain(tag, "product");
      filters.tag = tagDoc._id;
    }

    const result = await productService.listPublicProducts({ search: search || "", filters, page: parseInt(page, 10) || 1 });
    return res.json({ success: true, data: result.data, meta: paginationMeta(result) });
  } catch (error) {
    logError("[api/listProducts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productService.getPublicProductBySlug(req.params.slug);
    return res.json({ success: true, data: product });
  } catch (error) {
    logError("[api/getProduct] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Team ----

export async function listTeam(req, res, next) {
  try {
    const experts = await expertService.getActiveExperts();
    return res.json({ success: true, data: experts });
  } catch (error) {
    logError("[api/listTeam] Greška", error);
    next(error);
  }
}

export async function getTeamMember(req, res, next) {
  try {
    const expert = await expertService.getExpertBySlug(req.params.slug);
    return res.json({ success: true, data: expert });
  } catch (error) {
    logError("[api/getTeamMember] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Blog ----

export async function listPosts(req, res, next) {
  try {
    const { category, tag, search, page = 1 } = req.query;
    const filters = {};

    if (category) {
      const categoryDoc = await categoryService.getCategoryBySlugAndDomain(category, "post");
      filters.category = categoryDoc._id;
    }
    if (tag) {
      const tagDoc = await tagService.getTagBySlugAndDomain(tag, "post");
      filters.tag = tagDoc._id;
    }

    const result = await postService.findPublishedPosts({ page: parseInt(page, 10) || 1, filters, search: search || "" });
    return res.json({ success: true, data: result.data, meta: paginationMeta(result) });
  } catch (error) {
    logError("[api/listPosts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await postService.getPublicPostBySlug(req.params.slug);
    return res.json({ success: true, data: post });
  } catch (error) {
    logError("[api/getPost] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Business partners (B2B equipment sales) ----

export async function listBusinessPartners(req, res, next) {
  try {
    const result = await businessPartnerService.listPublicBusinessPartners();
    return res.json({ success: true, data: result.data });
  } catch (error) {
    logError("[api/listBusinessPartners] Greška", error);
    next(error);
  }
}

export async function getBusinessPartner(req, res, next) {
  try {
    const partner = await businessPartnerService.getPublicBusinessPartnerBySlug(req.params.slug);
    return res.json({ success: true, data: partner });
  } catch (error) {
    logError("[api/getBusinessPartner] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

export default {
  listServices, getService,
  listPackages, getPackage,
  listProducts, getProduct,
  listTeam, getTeamMember,
  listPosts, getPost,
  listBusinessPartners, getBusinessPartner,
};
