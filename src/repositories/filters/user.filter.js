/**
 * Builds the Mongo filter object for User list queries.
 */
export function buildUserFilter({ search = "", role = null, status = null, provider = null } = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) filter.role = role;
  if (status) filter.status = status;
  if (provider) filter.provider = provider;

  return filter;
}
