const SHOP_TRUST = [
  { icon: "bi-truck", title: "Brza dostava", text: "Šaljemo širom Srbije, sa jasno naznačenim rokom isporuke pre potvrde porudžbine." },
  { icon: "bi-patch-check", title: "Originalna oprema", text: "Prodajemo isključivo profesionalnu kozmetičku opremu i rezervne delove koje sami koristimo u radu." },
  { icon: "bi-headset", title: "Podrška nakon kupovine", text: "Tu smo za pitanja o korišćenju uređaja i dostupnosti rezervnih delova i nakon isporuke." },
  { icon: "bi-arrow-return-left", title: "Pravo na odustanak", text: "14 dana za odustanak od porudžbine, u skladu sa Zakonom o zaštiti potrošača." },
];

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

export function prepareProductListData(result, { query = {}, categories = [], tags = [], featured = [], sale = [], latestPosts = [], isLandingView = false, badgeTitle = null } = {}) {
  return {
    products: result.data,
    subtitle: "Oprema, delovi i potrošni materijal za profesionalnu kozmetičku negu.",
    // shown above the main grid only on the plain, unfiltered /prodavnica landing -
    // category/tag/search/badge views (and page 2+) go straight to the filtered grid
    isLandingView,
    badgeTitle,
    featured,
    sale,
    categoryTiles: isLandingView ? categories : [],
    trust: isLandingView ? SHOP_TRUST : [],
    faq: isLandingView ? SHOP_FAQ : [],
    latestPosts,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/prodavnica",
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: null, activeTagSlug: null },
    breadcrumbs: [{ label: "Prodavnica", url: null }],
  };
}

export function prepareProductCategoryData(category, result, query = {}, { categories = [], tags = [] } = {}) {
  return {
    category,
    products: result.data,
    subtitle: `Proizvodi iz kategorije „${category.naziv}”.`,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/prodavnica/kategorija/${category.slug}`,
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: category.slug, activeTagSlug: null },
    breadcrumbs: [
      { label: "Prodavnica", url: "/prodavnica" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareProductTagData(tag, result, query = {}, { categories = [], tags = [] } = {}) {
  return {
    tag,
    products: result.data,
    subtitle: `Proizvodi označeni sa „${tag.naziv}”.`,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/prodavnica/tag/${tag.slug}`,
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: null, activeTagSlug: tag.slug },
    breadcrumbs: [
      { label: "Prodavnica", url: "/prodavnica" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareProductDetailData(product, { relatedProducts = [], testimonials = [] } = {}) {
  return {
    product,
    relatedProducts,
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