export function buildPackageFilter({ search = "", category = null, tag = null, service = null, isActive = null } = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { shortDescription: { $regex: search, $options: "i" } },
    ];
  }

  if (category) filter.categories = category;
  if (tag) filter.tags = tag;
  if (service) filter["items.service"] = service;
  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;

  return filter;
}