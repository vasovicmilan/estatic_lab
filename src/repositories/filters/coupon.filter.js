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
  // `origin: "wheel"` = only wheel coupons; `excludeOrigin: "wheel"` = everything else
  // (also matches legacy documents that have no origin field)
  origin = null,
  excludeOrigin = null,
  wheelPrizeKey = null,
  // wheel coupon states: "used" | "active" | "expired"
  state = null,
} = {}) {
  const filter = {};

  if (search) {
    filter.code = { $regex: search, $options: "i" };
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.applicableServices = service;
  if (packageId) filter.applicablePackages = packageId;
  if (partner) filter.partner = partner;
  if (origin) filter.origin = origin;
  if (excludeOrigin) filter.origin = { $ne: excludeOrigin };
  if (wheelPrizeKey) filter.wheelPrizeKey = wheelPrizeKey;
  if (state) {
    const now = new Date();
    if (state === "used") filter.usedCount = { $gte: 1 };
    if (state === "active") Object.assign(filter, { usedCount: 0, isActive: true, validUntil: { $gte: now } });
    if (state === "expired") Object.assign(filter, { usedCount: 0, validUntil: { $lt: now } });
  }

  if (validNow) {
    const now = new Date();
    filter.isActive = true;
    filter.validFrom = { $lte: now };
    filter.validUntil = { $gte: now };
  }

  return filter;
}