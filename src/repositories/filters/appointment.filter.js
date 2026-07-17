/**
 * Builds the Mongo filter object for Appointment list queries.
 *
 * Role-scoping lives here (not ad hoc in the service) because "what can this role see"
 * is a query-shape concern: an employee needs appointments where they're the assigned
 * OR chosen therapist, OR appointments still unassigned - that's filter logic, not
 * business logic, so it belongs next to the other filter builders.
 */
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
    // matches against the contact snapshot, since appointments aren't always tied to a
    // fully-populated user record worth regex-searching through a $lookup
    filter.$or = (filter.$or || []).concat([
      { "contactSnapshot.firstName": { $regex: search, $options: "i" } },
      { "contactSnapshot.lastName": { $regex: search, $options: "i" } },
      { "contactSnapshot.email": { $regex: search, $options: "i" } },
    ]);
  }

  return filter;
}
