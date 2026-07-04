/**
 * Builds the Mongo filter object for Category list queries. `domain` is required in
 * practice (post vs service) — callers should always pass it, but it's not enforced
 * here since the repository/service layer is the right place for that validation.
 */
export function buildCategoryFilter({ search = "", domain = null, parent = undefined, isActive = null } = {}) {
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (domain) filter.domain = domain;

  // parent === null (explicit) means "only top-level categories"; undefined means "don't filter"
  if (parent !== undefined) filter.parent = parent;

  if (isActive !== null && isActive !== undefined) filter["meta.isActive"] = isActive;

  return filter;
}
