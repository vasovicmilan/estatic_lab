/**
 * Builds the Mongo filter object for Service list queries.
 */
export function buildServiceFilter({
  search = "",
  category = null,
  tag = null,
  isActive = null,
  highlight = null,
} = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { shortDescription: { $regex: search, $options: "i" } },
    ];
  }

  if (category) filter.categories = category;
  if (tag) filter.tags = tag;
  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (highlight !== null && highlight !== undefined) filter.highlight = highlight;

  return filter;
}