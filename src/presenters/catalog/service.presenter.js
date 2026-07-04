export function prepareServiceListData(result, { query = {}, categories = [] } = {}) {
  return {
    services: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/usluge",
      query,
    },
    sidebar: { categories },
    breadcrumbs: [{ label: "Usluge", url: null }],
  };
}

export function prepareServiceCategoryData(category, result, query = {}) {
  return {
    category,
    services: result.data,
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
