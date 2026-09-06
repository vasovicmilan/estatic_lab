/**
 * Builds the Mongo filter object for User list queries.
 */
export function buildUserFilter({ search = "", role = null, status = null, provider = null, excludeId = null } = {}) {
  const filter = {};

  // Anonymized accounts (see user.service.js's anonymizeUser) have had every
  // meaningful field scrubbed - there's nothing left to search, filter, or act
  // on, so they never surface in admin listings, regardless of what status
  // filter is requested. If "deleted" is explicitly passed (shouldn't happen
  // from the current UI, but don't trust that), it's treated the same as no
  // status filter at all rather than actually querying for anonymized accounts.
  filter.status = status && status !== "deleted" ? status : { $ne: "deleted" };

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) filter.role = role;
  if (provider) filter.provider = provider;
  if (excludeId) filter._id = { $ne: excludeId };

  return filter;
}