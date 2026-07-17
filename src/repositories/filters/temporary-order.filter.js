/**
 * Builds the Mongo filter object for TemporaryOrder list queries.
 */
export function buildTemporaryOrderFilter({ search = "", user = null, expired = null } = {}) {
  const filter = {};

  if (user) filter.user = user;

  if (expired === true) filter.tokenExpiration = { $lt: new Date() };
  else if (expired === false) filter.tokenExpiration = { $gte: new Date() };

  if (search) {
    filter.$or = [
      { "contactSnapshot.firstName": { $regex: search, $options: "i" } },
      { "contactSnapshot.lastName": { $regex: search, $options: "i" } },
      { "contactSnapshot.email": { $regex: search, $options: "i" } },
    ];
  }

  return filter;
}