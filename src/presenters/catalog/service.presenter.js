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

export function prepareServiceListData(result, { query = {}, categories = [], tags = [] } = {}) {
  return {
    services: result.data,
    subtitle: "Svaki tretman vodi naš tim sertifikovanih terapeuta - birajte prema potrebi, o ostalom brinemo mi.",
    intro: SERVICE_LIST_INTRO,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/usluge",
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: null, activeTagSlug: null },
    breadcrumbs: [{ label: "Usluge", url: null }],
  };
}

export function prepareServiceCategoryData(category, result, query = {}, { categories = [], tags = [] } = {}) {
  return {
    category,
    services: result.data,
    subtitle: `Usluge iz kategorije „${category.naziv}“, birane i izvedene sa istom pažnjom kao i sve ostalo kod nas.`,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/usluge/kategorija/${category.slug}`,
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: category.slug, activeTagSlug: null },
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareServiceTagData(tag, result, query = {}, { categories = [], tags = [] } = {}) {
  return {
    tag,
    services: result.data,
    subtitle: `Usluge označene sa „${tag.naziv}“ - pažljivo odabrane da odgovore na ono što vam treba.`,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/usluge/tag/${tag.slug}`,
      query,
    },
    sidebar: { categories, tags, activeCategorySlug: null, activeTagSlug: tag.slug },
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareServiceDetailData(service, { relatedServices = [], testimonials = [] } = {}) {
  return {
    service,
    relatedServices,
    testimonials,
    bookingUrl: `/zakazivanje/${service.slug}`,
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: service.naziv, url: null },
    ],
  };
}