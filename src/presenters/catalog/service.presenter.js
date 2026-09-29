import { PUBLIC_PAGE_SIZES } from "../../utils/pagination.util.js";
import { DEFAULT_SERVICES_INTRO } from "../../config/site-content-defaults.js";
import { buildCategoryTabRows } from "../../utils/category-tabs.util.js";


// Builds the sticky category filter bar shown at the top of every /usluge
// view (plain list, category, and tag pages alike). These are real links to
// existing routes (not client-side filtering), so every tab is still its own
// crawlable, bookmarkable page.
// Groups a flat category list into one chip-row per hierarchy level - see
// category-tabs.util.js for the full explanation (shared with product.presenter.js).
function buildServiceCategoryTabRows(categories, activeCategorySlug, totalCount) {
  return buildCategoryTabRows(categories, activeCategorySlug, totalCount, {
    basePath: "/usluge/kategorija",
    allLabel: "Sve usluge",
  });
}

// Builds the "search by topic" tag chips shown below the grid on every /usluge
// view, with the current tag (if any) marked active.
function buildTagChips(tags = [], activeTagSlug = null) {
  return tags.map((tag) => ({
    label: tag.naziv,
    href: `/usluge/tag/${tag.slug}`,
    active: tag.slug === activeTagSlug,
  }));
}

export function prepareServiceListData(result, { query = {}, categories = [], tags = [], totalCount = 0, intro = DEFAULT_SERVICES_INTRO } = {}) {
  return {
    services: result.data,
    subtitle: "Svaki tretman vodi naš tim sertifikovanih terapeuta - birajte prema potrebi, o ostalom brinemo mi.",
    intro,
    stats: [
      { value: totalCount, label: "tretmana" },
      { value: categories.length, label: "kategorija" },
    ],
    categoryTabRows: buildServiceCategoryTabRows(categories, null, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: "/usluge",
      query,
    },
    breadcrumbs: [{ label: "Usluge", url: null }],
  };
}

export function prepareServiceCategoryData(category, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    category,
    services: result.data,
    subtitle: `Usluge iz kategorije „${category.naziv}“, birane i izvedene sa istom pažnjom kao i sve ostalo kod nas.`,
    categoryTabRows: buildServiceCategoryTabRows(categories, category.slug, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: `/usluge/kategorija/${category.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareServiceTagData(tag, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    tag,
    services: result.data,
    subtitle: `Usluge označene sa „${tag.naziv}“ - pažljivo odabrane da odgovore na ono što vam treba.`,
    categoryTabRows: buildServiceCategoryTabRows(categories, null, totalCount),
    tagChips: buildTagChips(tags, tag.slug),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
      total: result.total,
      pageSizeOptions: PUBLIC_PAGE_SIZES,
      basePath: `/usluge/tag/${tag.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareServiceDetailData(service, { relatedServices = [], relatedProducts = [], testimonials = [] } = {}) {
  return {
    service,
    relatedServices,
    relatedProducts,
    testimonials,
    bookingUrl: `/zakazivanje/${service.slug}`,
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: service.naziv, url: null },
    ],
  };
}