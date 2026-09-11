/**
 * Builds the Mongo filter object for Product list queries.
 */
export function buildProductFilter({
  search = "",
  category = null,
  // Products in ANY of these category ids are excluded outright - independent
  // from (and can be combined with) `category` above. Used by the partner
  // catalog to filter out a coupon's excluded categories at the DB level
  // (see coupon.service.js's resolveProductCouponEligibility and
  // partner-account.controller.js's catalog()), rather than filtering an
  // already-paginated result set after the fact - that would silently return
  // fewer than `limit` items per page and throw off total/totalPages.
  excludedCategories = null,
  tag = null,
  isActive = null,
  inStock = null,
  minPrice = undefined,
  maxPrice = undefined,
  sku = null,
  badge = null,
  ids = null,
} = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { shortDescription: { $regex: search, $options: "i" } },
    ];
  }

  if (sku) filter.sku = sku.toLowerCase().trim();
  // `category` alone keeps its previous exact shape (raw id, or { $in: [...] }
  // for an array) so existing callers/tests see identical query semantics.
  // Only wraps into a combined { $in, $nin } object once excludedCategories is
  // actually in play - see the comment on that param above.
  if (category && !(excludedCategories && excludedCategories.length > 0)) {
    filter.categories = Array.isArray(category) ? { $in: category } : category;
  } else if (category || (excludedCategories && excludedCategories.length > 0)) {
    const categoryConditions = {};
    if (category) categoryConditions.$in = Array.isArray(category) ? category : [category];
    if (excludedCategories?.length) categoryConditions.$nin = excludedCategories;
    filter.categories = categoryConditions;
  }
  if (tag) filter.tags = tag;
  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (badge) filter.badge = badge;

  // "in stock" means at least one active variation still has stock - not a
  // product-level field, since price/stock only ever live on variations
  if (inStock === true) {
    filter.variations = { $elemMatch: { stock: { $gt: 0 }, isActive: true } };
  } else if (inStock === false) {
    filter.variations = { $not: { $elemMatch: { stock: { $gt: 0 }, isActive: true } } };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter = {};
    if (minPrice !== undefined) priceFilter.$gte = minPrice;
    if (maxPrice !== undefined) priceFilter.$lte = maxPrice;
    filter["variations.price"] = priceFilter;
  }

  if (ids && Array.isArray(ids) && ids.length > 0) {
    filter._id = { $in: ids };
  }

  return filter;
}