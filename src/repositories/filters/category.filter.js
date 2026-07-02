export function buildCategoryFilter({ search = "", domain = null, parent = undefined, isActive = null } = {}) {
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (domain) filter.domain = domain;

  if (parent !== undefined) filter.parent = parent;

  if (isActive !== null && isActive !== undefined) filter["meta.isActive"] = isActive;

  return filter;
}