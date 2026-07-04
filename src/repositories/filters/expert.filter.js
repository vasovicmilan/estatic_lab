/**
 * Builds the Mongo filter object for Expert list queries.
 */
export function buildExpertFilter({ search = "", isActive = null, service = null } = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.services = service;

  return filter;
}
