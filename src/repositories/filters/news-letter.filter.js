export function buildNewsLetterFilter({ search = "", status = null } = {}) {
  const filter = {};

  if (search) {
    filter.email = { $regex: search, $options: "i" };
  }

  if (status) filter.status = status;

  return filter;
}