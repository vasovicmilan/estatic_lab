import * as serviceService from "../../../services/service.service.js";
import * as packageService from "../../../services/package.service.js";
import * as productService from "../../../services/product.service.js";
import * as expertService from "../../../services/expert.service.js";
import * as postService from "../../../services/post.service.js";
import * as businessPartnerService from "../../../services/business-partner.service.js";
import { BUSINESS } from "../../../config/business.config.js";
import siteContentService from "../../../services/site-content.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as tagService from "../../../services/tag.service.js";
import { generateSeo } from "../../../seo/index.js";
import { logError } from "../../../utils/logger.util.js";
import { resolvePage, pickPaginationMeta } from "../../../utils/pagination.util.js";

// Every function below calls the exact same service-layer functions the public web
// pages call (controllers/web/catalog/*, controllers/web/public/*,
// controllers/web/blog/*) - the services already return mapped, presentation-safe
// data (see mapServiceForPublicDetail etc.), so there's nothing left to do here but
// shape the pagination envelope and res.json() it.
//
// SEO: the five entity-detail routes below (getService/getPackage/getProduct/getPost/
// getTeamMember) call the exact same generateSeo(type, entity, req) dispatcher the
// matching web controller calls (see controllers/web/catalog/service.controller.js's
// serviceDetails, product.controller.js's productDetails, blog/blog.controller.js's
// blogPostDetails, public/expert.controller.js's expertDetails) - same title/
// description/canonical/robots/JSON-LD/OG/Twitter fields, just attached to the JSON
// response instead of passed to res.render(). Listing routes deliberately do NOT get a
// `seo` field here - those are simple, mostly-static page titles ("Usluge", "Prodavnica",
// "Blog"...) a client can just as well hold in its own route config, and the ItemList
// JSON-LD the web listing pages build (buildItemListJsonLd) depends on the page's own
// rendered URL structure in a way that doesn't obviously belong in a generic API
// response - left as a possible follow-up, not done here.
// Business partners (B2B equipment sales) have no dedicated SEO builder - the web
// public/business-partner.controller.js doesn't call generateSeo for them either, so
// there's nothing to mirror; left out on purpose, not an oversight.

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

    const result = await serviceService.findActiveServices({ page: resolvePage(page), filters });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/listServices] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getService(req, res, next) {
  try {
    const service = await serviceService.getServiceBySlug(req.params.slug);
    const seo = await generateSeo("service", service, req);
    return res.json({ success: true, data: service, seo });
  } catch (error) {
    logError("[api/getService] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Packages ----

export async function listPackages(req, res, next) {
  try {
    const { page = 1 } = req.query;
    const result = await packageService.findActivePackages({ page: resolvePage(page), limit: 100 });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/listPackages] Greška", error);
    next(error);
  }
}

export async function getPackage(req, res, next) {
  try {
    const pkg = await packageService.getPackageBySlug(req.params.slug);
    const seo = await generateSeo("package", pkg, req);
    return res.json({ success: true, data: pkg, seo });
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

    const result = await productService.listPublicProducts({ search: search || "", filters, page: resolvePage(page) });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/listProducts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productService.getPublicProductBySlug(req.params.slug);
    const seo = await generateSeo("product", product, req);
    return res.json({ success: true, data: product, seo });
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
    const seo = await generateSeo("expert", expert, req);
    return res.json({ success: true, data: expert, seo });
  } catch (error) {
    logError("[api/getTeamMember] Greška", error, { slug: req.params.slug });
    next(error);
  }
}

// ---- Blog ----

export async function listPosts(req, res, next) {
  try {
    const { category, tag, search, page = 1, limit } = req.query;
    const filters = {};

    if (category) {
      const categoryDoc = await categoryService.getCategoryBySlugAndDomain(category, "post");
      filters.category = categoryDoc._id;
    }
    if (tag) {
      const tagDoc = await tagService.getTagBySlugAndDomain(tag, "post");
      filters.tag = tagDoc._id;
    }

    // limit is optional and left out unless the caller asks for a specific
    // page size - findPublishedPosts defaults to 10 (and resolveLimit clamps
    // whatever comes through to [1, 100] regardless), same as every other
    // public listing route here (services/products/packages).
    const result = await postService.findPublishedPosts({
      page: resolvePage(page),
      filters,
      search: search || "",
      ...(limit ? { limit } : {}),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/listPosts] Greška", error, { query: req.query });
    next(error);
  }
}

// Blog "chrome" (category filter pills + tag chips), the exact data
// prepareBlogListData's buildCategoryTabs/buildTagChips (see
// presenters/blog/blog.presenter.js - only ever used by the old EJS site
// until now) needs to render itself. Deliberately its OWN endpoint rather
// than folded into listPosts above: this data (all post categories with
// their live post counts, all post tags) doesn't depend on the requested
// page/search/category/tag at all, so bundling it into every paginated
// listPosts call would mean recomputing category counts on every single
// page flip for data that's the same every time - one extra parallel
// request (not a waterfall - the frontend fires this alongside its posts
// request) instead of redundant work on every list call.
export async function getBlogFilters(req, res, next) {
  try {
    const [categoriesRaw, tags, totalCount] = await Promise.all([
      categoryService.getPublicCategories("post"),
      tagService.getPublicTags("post"),
      postService.countAllPublishedPosts(),
    ]);
    const categories = await postService.attachPostCountsToCategories(categoriesRaw);
    return res.json({ success: true, data: { categories, tags, totalCount } });
  } catch (error) {
    logError("[api/getBlogFilters] Greška", error);
    next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await postService.getPublicPostBySlug(req.params.slug);
    const seo = await generateSeo("post", post, req);
    return res.json({ success: true, data: post, seo });
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

// ---- Business contact info (footer, contact page) ----
// BUSINESS (business.config.js) is already public: it's rendered into the
// EJS footer/contact page and into the site-wide Organization JSON-LD on
// every public page, so serving it as JSON here is not a new disclosure -
// just the first time the SPA can read it without duplicating it by hand.
// Serbian field names to match every other public mapper's convention.
export async function getBusinessInfo(req, res) {
  return res.json({
    success: true,
    data: {
      naziv: BUSINESS.name,
      email: BUSINESS.email,
      telefon: BUSINESS.phone,
      telefonHref: BUSINESS.phoneHref,
      adresa: BUSINESS.address?.full || null,
      drustveneMreze: BUSINESS.sameAs || [],
    },
  });
}

// DB-backed marketing/legal content (see site-content.service.js's header
// comment for why this now lives in the database instead of hardcoded
// presenter constants) - one thin passthrough per public page, same shape
// the admin edit screen reads/writes (site-content.service.js returns the
// same shape to both, see that file's own comment on why).
export async function getAboutPage(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getAbout() });
  } catch (error) {
    logError("[api/getAboutPage] Greška", error);
    next(error);
  }
}

export async function getFaqPage(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getFaq() });
  } catch (error) {
    logError("[api/getFaqPage] Greška", error);
    next(error);
  }
}

export async function getPrivacyPolicyPage(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getPrivacyPolicy() });
  } catch (error) {
    logError("[api/getPrivacyPolicyPage] Greška", error);
    next(error);
  }
}

export async function getTermsPage(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getTermsAndConditions() });
  } catch (error) {
    logError("[api/getTermsPage] Greška", error);
    next(error);
  }
}

export async function getPartnershipPage(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getPartnership() });
  } catch (error) {
    logError("[api/getPartnershipPage] Greška", error);
    next(error);
  }
}

export async function getHomeIntro(req, res, next) {
  try {
    const [homeIntro, whyUs] = await Promise.all([siteContentService.getHomeIntro(), siteContentService.getWhyUs()]);
    return res.json({ success: true, data: { ...homeIntro, whyUs } });
  } catch (error) {
    logError("[api/getHomeIntro] Greška", error);
    next(error);
  }
}

export async function getTeamIntro(req, res, next) {
  try {
    return res.json({ success: true, data: await siteContentService.getTeamIntro() });
  } catch (error) {
    logError("[api/getTeamIntro] Greška", error);
    next(error);
  }
}

export default {
  listServices, getService,
  listPackages, getPackage,
  listProducts, getProduct,
  listTeam, getTeamMember,
  listPosts, getPost, getBlogFilters,
  listBusinessPartners, getBusinessPartner,
  getBusinessInfo,
  getAboutPage, getFaqPage, getPrivacyPolicyPage, getTermsPage, getPartnershipPage, getHomeIntro, getTeamIntro,
};
