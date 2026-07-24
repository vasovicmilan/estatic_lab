/**
 * Builds the Mongo filter object for Coupon list queries.
 */
export function buildCouponFilter({
  search = "",
  isActive = null,
  service = null,
  partner = null,
  // "package" is a reserved word as a bare identifier in strict-mode JS (all ES
  // modules), so it's renamed to packageId on destructure - the property key
  // itself (what callers pass in) stays `package`.
  package: packageId = null,
  validNow = false,
} = {}) {
  const filter = {};

  if (search) {
    filter.code = { $regex: search, $options: "i" };
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.applicableServices = service;
  if (packageId) filter.applicablePackages = packageId;
  if (partner) filter.partner = partner;

  if (validNow) {
    const now = new Date();
    filter.isActive = true;
    filter.validFrom = { $lte: now };
    filter.validUntil = { $gte: now };
  }

  return filter;
}