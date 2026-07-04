/**
 * Builds the Mongo filter object for NewsLetter subscriber list queries.
 */
export function buildNewsLetterFilter({ search = "", status = null } = {}) {
  const filter = {};

  if (search) {
    filter.email = { $regex: search, $options: "i" };
  }

  if (status) filter.status = status;

  return filter;
}
