export function buildTagFilter({ search = "", domain = null, isActive = null } = {}) {
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (domain) filter.domain = domain;
  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;

  return filter;
}