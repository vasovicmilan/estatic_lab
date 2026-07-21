/**
 * Builds the Mongo filter object for Coupon list queries.
 */
export function buildCouponFilter({ search = "", isActive = null, service = null, partner = null, validNow = false } = {}) {
  const filter = {};

  if (search) {
    filter.code = { $regex: search, $options: "i" };
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.applicableServices = service;
  if (partner) filter.partner = partner;

  if (validNow) {
    const now = new Date();
    filter.isActive = true;
    filter.validFrom = { $lte: now };
    filter.validUntil = { $gte: now };
  }

  return filter;
}