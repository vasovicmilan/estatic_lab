/**
 * Builds the Mongo filter object for Product list queries.
 */
export function buildProductFilter({
  search = "",
  category = null,
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
  if (category) filter.categories = category;
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