import { buildCategoryTabRows } from "./category-tabs.util.js";

// Shown only on the plain /usluge listing (no active category/tag filter) -
// gives the page real, indexable body copy that explains what the services
// are and how to choose between them, before the visitor starts browsing.
const SERVICE_LIST_INTRO = {
  eyebrow: "Naše usluge",
  title: "Masaže, ESMA tretmani i nega lica i tela u Novom Sadu",
  lead:
    "Svaki tretman kod nas ima jasnu svrhu - od opuštanja i ublažavanja bolova, do oblikovanja tela i nege kože. Ovde birate tretman prema cilju koji imate, a ne obrnuto.",
  paragraphs: [
    "ESMA tretmani (elektrostimulacija, ultrazvuk, mikrostruje i svetlosna terapija) kombinuju se prema potrebi - za jačanje mišićnog tonusa, smanjenje celulita, limfnu drenažu ili lifting lica bez igala. Klasične i sportske masaže rade naši sertifikovani terapeuti, ručno, prilagođeno svakom telu.",
  ],
  highlights: [
    {
      icon: "bi-heart-pulse",
      title: "Prema cilju, ne prema modi",
      text: "Birate tretman prema onome što želite da postignete - opuštanje, manje bolova, čvršću kožu ili bolji tonus.",
    },
    {
      icon: "bi-award",
      title: "Sertifikovani terapeuti",
      text: "Svaki tretman izvodi obučen terapeut, uz opremu i protokole prilagođene vašem stanju.",
    },
    {
      icon: "bi-clipboard-check",
      title: "Jasne informacije pre zakazivanja",
      text: "Cena, trajanje i eventualne kontraindikacije navedeni su na stranici svake usluge, bez iznenađenja.",
    },
    {
      icon: "bi-collection",
      title: "Uštedite uz pakete",
      text: "Za tretmane koje ponavljate više puta, pogledajte naše pakete i platite manje po poseti.",
    },
  ],
};

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

export function prepareServiceListData(result, { query = {}, categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    services: result.data,
    subtitle: "Svaki tretman vodi naš tim sertifikovanih terapeuta - birajte prema potrebi, o ostalom brinemo mi.",
    intro: SERVICE_LIST_INTRO,
    stats: [
      { value: totalCount, label: "tretmana" },
      { value: categories.length, label: "kategorija" },
    ],
    categoryTabRows: buildServiceCategoryTabRows(categories, null, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
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