const SHOP_TRUST = [
  { icon: "bi-truck", title: "Brza dostava", text: "Šaljemo širom Srbije, sa jasno naznačenim rokom isporuke pre potvrde porudžbine." },
  { icon: "bi-patch-check", title: "Originalna oprema", text: "Prodajemo isključivo profesionalnu kozmetičku opremu i rezervne delove koje sami koristimo u radu." },
  { icon: "bi-headset", title: "Podrška nakon kupovine", text: "Tu smo za pitanja o korišćenju uređaja i dostupnosti rezervnih delova i nakon isporuke." },
  { icon: "bi-arrow-return-left", title: "Pravo na odustanak", text: "14 dana za odustanak od porudžbine, u skladu sa Zakonom o zaštiti potrošača." },
];

// Gives the /prodavnica landing real, indexable body copy above the trust
// badges - what's actually being sold here and why it's the same equipment
// used in the studio, not just a generic marketplace.
const SHOP_INTRO = {
  eyebrow: "Prodavnica",
  title: "Profesionalna kozmetička oprema i potrošni materijal",
  lead:
    "Ovde prodajemo istu opremu, delove i potrošni materijal koje sami koristimo na tretmanima u Estetik Lab centru - ne generičku kozmetiku, već ono što stoji iza rezultata koje vidite na tretmanu.",
  paragraphs: [
    "U ponudi su rezervni delovi i potrošni materijal za uređaje koje koristimo na ESMA tretmanima (elektrode, nastavci, gelovi za provodljivost), kao i profesionalna oprema za kućnu negu. Uz svaku porudžbinu ostaje podrška našeg tima - i posle isporuke, ako vam zatreba pomoć oko korišćenja ili dostupnosti delova.",
  ],
};

const SHOP_FAQ = [
  {
    pitanje: "Kako se plaća porudžbina?",
    odgovor: "Online plaćanje karticom trenutno nije dostupno. Način plaćanja (uplata na račun, pouzećem i sl.) dogovara se prilikom potvrde porudžbine.",
  },
  {
    pitanje: "Koliko traje dostava?",
    odgovor: "Rok isporuke zavisi od dostupnosti proizvoda i saopštava se prilikom potvrde porudžbine ili naknadno email porukom.",
  },
  {
    pitanje: "Mogu li da vratim proizvod?",
    odgovor: "Da - imate pravo da odustanete od porudžbine u roku od 14 dana od prijema, bez navođenja razloga. Detalji su opisani u Uslovima korišćenja.",
  },
  {
    pitanje: "Da li mogu da naručim bez registracije?",
    odgovor: "Da, porudžbinu možete napraviti i kao gost. Nakon potvrde emailom, automatski dobijate nalog kako biste mogli da pratite status porudžbine.",
  },
];

// Builds the category filter bar shown at the top of every /prodavnica view
// (plain list, category, and tag pages alike) - same pattern as /usluge:
// real links to existing routes, not client-side filtering.
function buildCategoryTabs(categories = [], activeCategorySlug = null, totalCount = 0) {
  return [
    { label: "Svi proizvodi", href: "/prodavnica", count: totalCount, active: !activeCategorySlug },
    ...categories.map((cat) => ({
      label: cat.naziv,
      href: `/prodavnica/kategorija/${cat.slug}`,
      count: cat.count || 0,
      active: cat.slug === activeCategorySlug,
    })),
  ];
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

export function prepareProductListData(result, { query = {}, categories = [], tags = [], totalCount = 0, latestPosts = [], isLandingView = false, badgeTitle = null } = {}) {
  return {
    products: result.data,
    subtitle: "Oprema, delovi i potrošni materijal za profesionalnu kozmetičku negu.",
    // shown above the main grid only on the plain, unfiltered /prodavnica landing -
    // category/tag/search/badge views (and page 2+) go straight to the filtered grid
    isLandingView,
    badgeTitle,
    search: query.search || "",
    resultCount: result.total,
    intro: isLandingView ? SHOP_INTRO : null,
    categoryTabs: buildCategoryTabs(categories, null, totalCount),
    tagChips: buildTagChips(tags, null),
    trust: isLandingView ? SHOP_TRUST : [],
    faq: isLandingView ? SHOP_FAQ : [],
    latestPosts,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
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
    categoryTabs: buildCategoryTabs(categories, category.slug, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
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
    categoryTabs: buildCategoryTabs(categories, null, totalCount),
    tagChips: buildTagChips(tags, tag.slug),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
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