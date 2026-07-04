/**
 * Builds the Mongo filter object for Role list queries. Kept isolated so the repository
 * and any future admin search screen never construct raw Mongo queries inline.
 */
export function buildRoleFilter({ search = "", name = null } = {}) {
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (name) {
    filter.name = name;
  }

  return filter;
}
