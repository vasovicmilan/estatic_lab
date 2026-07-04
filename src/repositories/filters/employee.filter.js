/**
 * Builds the Mongo filter object for Employee list queries.
 */
export function buildEmployeeFilter({ isActive = null, service = null, expert = null } = {}) {
  const filter = {};

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.services = service;
  if (expert) filter.expert = expert;

  return filter;
}
