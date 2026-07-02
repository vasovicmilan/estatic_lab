export function buildCouponFilter({ search = "", isActive = null, service = null, validNow = false } = {}) {
  const filter = {};

  if (search) {
    filter.code = { $regex: search, $options: "i" };
  }

  if (isActive !== null && isActive !== undefined) filter.isActive = isActive;
  if (service) filter.applicableServices = service;

  if (validNow) {
    const now = new Date();
    filter.isActive = true;
    filter.validFrom = { $lte: now };
    filter.validUntil = { $gte: now };
  }

  return filter;
}