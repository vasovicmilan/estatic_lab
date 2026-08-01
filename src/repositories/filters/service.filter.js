/**
 * Builds the Mongo filter object for Service list queries.
 */
export function buildServiceFilter({
  search = "",
  category = null,
  tag = null,
  resource = null,
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
  // `resources` is an array field (see service.model.js) - Mongo automatically
  // matches a scalar filter value against any element of an array field, so
  // this finds every service that requires this resource among possibly
  // several, not just services with exactly one resource.
  if (resource) filter.resources = resource;
  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (highlight !== null && highlight !== undefined) filter.highlight = highlight;

  return filter;
}