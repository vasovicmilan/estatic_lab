/**
 * Builds the Mongo filter object for Testimonial list queries.
 */
export function buildTestimonialFilter({ status = null, service = null, product = null, isFeatured = null, minRating = null } = {}) {
  const filter = {};

  if (status) filter.status = status;
  if (service) filter.service = service;
  if (product) filter.product = product;
  if (isFeatured !== null && isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (minRating !== null && minRating !== undefined) filter.rating = { $gte: minRating };

  return filter;
}