/**
 * Builds the Mongo filter object for Resource list queries.
 */
export function buildResourceFilter({ search = "", isActive = null } = {}) {
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;

  return filter;
}