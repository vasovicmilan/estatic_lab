export function buildCommissionEntryFilter({ earnerType = null, employee = null, partner = null, status = null, statusIn = null, sourceType = null, appointment = null, packagePurchase = null } = {}) {
  const filter = {};

  if (earnerType) filter.earnerType = earnerType;
  if (employee) filter.employee = employee;
  if (partner) filter.partner = partner;
  if (statusIn) filter.status = { $in: statusIn };
  else if (status) filter.status = status;
  if (sourceType) filter.sourceType = sourceType;
  if (appointment) filter.appointment = appointment;
  if (packagePurchase) filter.packagePurchase = packagePurchase;

  return filter;
}