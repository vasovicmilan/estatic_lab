export function buildTestimonialFilter({ status = null, service = null, isFeatured = null, minRating = null } = {}) {
  const filter = {};

  if (status) filter.status = status;
  if (service) filter.service = service;
  if (isFeatured !== null && isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (minRating !== null && minRating !== undefined) filter.rating = { $gte: minRating };

  return filter;
}