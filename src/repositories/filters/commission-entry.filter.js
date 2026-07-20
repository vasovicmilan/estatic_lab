export function buildCommissionEntryFilter({ earnerType = null, employee = null, partner = null, status = null, statusIn = null } = {}) {
  const filter = {};

  if (earnerType) filter.earnerType = earnerType;
  if (employee) filter.employee = employee;
  if (partner) filter.partner = partner;
  if (statusIn) filter.status = { $in: statusIn };
  else if (status) filter.status = status;

  return filter;
}