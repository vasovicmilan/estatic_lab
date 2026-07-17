export function prepareServiceListData(result, { query = {}, categories = [], tags = [] } = {}) {
  return {
    services: result.data,
    subtitle: "Svaki tretman vodi naš tim sertifikovanih terapeuta - birajte prema potrebi, o ostalom brinemo mi.",
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