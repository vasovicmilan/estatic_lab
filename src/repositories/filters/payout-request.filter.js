export function buildPayoutRequestFilter({ earnerType = null, employee = null, partner = null, status = null } = {}) {
  const filter = {};

  if (earnerType) filter.earnerType = earnerType;
  if (employee) filter.employee = employee;
  if (partner) filter.partner = partner;
  if (status) filter.status = status;

  return filter;
}