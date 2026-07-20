/**
 * Builds the Mongo filter object for Partner list queries.
 */
export function buildPartnerFilter({ isActive = null } = {}) {
  const filter = {};

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;

  return filter;
}