/**
 * Builds the Mongo filter object for NewsLetter subscriber list queries.
 */
export function buildNewsLetterFilter({ search = "", status = null, source = null, interest = null } = {}) {
  const filter = {};

  if (search) {
    const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ email: rx }, { firstName: rx }];
  }

  if (status) filter.status = status;
  // legacy subscribers have no `source` field at all - Mongoose defaults only apply on create
  if (source) filter.source = source === "unknown" ? { $in: ["unknown", null] } : source;
  if (interest) filter.interests = interest;

  return filter;
}
