export function buildAppointmentFilter({
  search = "",
  userId = null,
  employeeId = null,
  serviceId = null,
  status = null,
  statusIn = null,
  dateFrom = null,
  dateTo = null,
  unassignedOnly = false,
} = {}) {
  const filter = {};

  if (userId) filter.user = userId;

  if (employeeId) {
    filter.$or = [{ employee: employeeId }, { assignedTo: employeeId }];
  }

  if (unassignedOnly) {
    filter.employee = null;
    filter.assignedTo = null;
    filter.status = "pending";
  }

  if (serviceId) filter.service = serviceId;

  if (status) filter.status = status;
  if (statusIn) filter.status = { $in: statusIn };

  if (dateFrom || dateTo) {
    filter.startTime = {};
    if (dateFrom) filter.startTime.$gte = dateFrom;
    if (dateTo) filter.startTime.$lt = dateTo;
  }

  if (search) {
    filter.$or = (filter.$or || []).concat([
      { "contactSnapshot.firstName": { $regex: search, $options: "i" } },
      { "contactSnapshot.lastName": { $regex: search, $options: "i" } },
      { "contactSnapshot.email": { $regex: search, $options: "i" } },
    ]);
  }

  return filter;
}