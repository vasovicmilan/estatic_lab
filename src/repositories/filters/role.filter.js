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