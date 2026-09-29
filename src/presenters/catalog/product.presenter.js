import { PUBLIC_PAGE_SIZES } from "../../utils/pagination.util.js";
import { DEFAULT_SHOP_INTRO, DEFAULT_SHOP_TRUST, DEFAULT_SHOP_FAQ } from "../../config/site-content-defaults.js";
import { buildCategoryTabRows } from "../../utils/category-tabs.util.js";




// Builds the category filter bar shown at the top of every /prodavnica view
// (plain list, category, and tag pages alike) - same pattern as /usluge:
// real links to existing routes, not client-side filtering.
// Groups a flat category list (all categories in the domain, regardless of
// depth) into one chip-row per hierarchy level - see category-tabs.util.js
// for the full explanation (shared with service.presenter.js).
function buildProductCategoryTabRows(categories, activeCategorySlug, totalCount) {
  return buildCategoryTabRows(categories, activeCategorySlug, totalCount, {
    basePath: "/prodavnica/kategorija",
    allLabel: "Svi proizvodi",
  });
}

// Builds the "search by topic" tag chips shown below the grid, with the
// current tag (if any) marked active - same pattern as /blog. The controller
// already fetched `tags` via tagService.getPublicTags("product") and passed
// it in; this was the missing piece turning that into chips the view renders.
function buildTagChips(tags = [], activeTagSlug = null) {
  return tags.map((tag) => ({
    label: tag.naziv,
    href: `/prodavnica/tag/${tag.slug}`,
    active: tag.slug === activeTagSlug,
  }));
}

export function prepareProductListData(result, { query = {}, categories = [], tags = [], totalCount = 0, latestPosts = [], isLandingView = false, badgeTitle = null, shopIntro = null } = {}) {
  const shopContent = shopIntro || { ...DEFAULT_SHOP_INTRO, trust: DEFAULT_SHOP_TRUST, faq: DEFAULT_SHOP_FAQ };
  return {
    products: result.data,
    subtitle: "Oprema, delovi i potrošni materijal za profesionalnu kozmetičku negu.",
    // shown above the main grid only on the plain, unfiltered /prodavnica landing -
    // category/tag/search/badge views (and page 2+) go straight to the filtered grid
    isLandingView,
    badgeTitle,
    search: query.search || "",
    resultCount: result.total,
    intro: isLandingView ? { eyebrow: shopContent.eyebrow, title: shopContent.title, lead: shopContent.lead, paragraphs: shopContent.paragraphs } : null,
    categoryTabRows: buildProductCategoryTabRows(categories, null, totalCount),
    tagChips: buildTagChips(tags, null),
    trust: isLandingView ? shopContent.trust : [],
    faq: isLandingView ? shopContent.faq : [],
    latestPosts,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: "/prodavnica",
      query,
    },
    breadcrumbs: [{ label: "Prodavnica", url: null }],
  };
}

export function prepareProductCategoryData(category, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    category,
    products: result.data,
    subtitle: `Proizvodi iz kategorije „${category.naziv}”.`,
    categoryTabRows: buildProductCategoryTabRows(categories, category.slug, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: `/prodavnica/kategorija/${category.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Prodavnica", url: "/prodavnica" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareProductTagData(tag, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    tag,
    products: result.data,
    subtitle: `Proizvodi označeni sa „${tag.naziv}”.`,
    categoryTabRows: buildProductCategoryTabRows(categories, null, totalCount),
    tagChips: buildTagChips(tags, tag.slug),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: `/prodavnica/tag/${tag.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Prodavnica", url: "/prodavnica" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareProductDetailData(product, { relatedProducts = [], relatedServices = [], testimonials = [] } = {}) {
  return {
    product,
    relatedProducts,
    relatedServices,
    testimonials,
    breadcrumbs: [
      { label: "Prodavnica", url: "/prodavnica" },
      { label: product.naziv, url: null },
    ],
  };
}

export default {
  prepareProductListData,
  prepareProductCategoryData,
  prepareProductTagData,
  prepareProductDetailData,
};