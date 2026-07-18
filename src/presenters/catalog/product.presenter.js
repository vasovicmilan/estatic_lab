export function prepareProductListData(result, { query = {}, categories = [], tags = [], featured = [], sale = [] } = {}) {
  const isLandingView = featured.length > 0 || sale.length > 0;

  return {
    products: result.data,
    subtitle: "Oprema, delovi i potrošni materijal za profesionalnu kozmetičku negu.",
    // shown above the main grid only on the plain, unfiltered /prodavnica landing -
    // category/tag/search views (and page 2+) go straight to the filtered grid instead
    isLandingView,
    featured,
    sale,
    categoryTiles: isLandingView ? categories : [],
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