import Appointment from "../models/appointment.model.js";
import { buildAppointmentFilter } from "./filters/appointment.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

// statuses that actually hold a slot busy — cancelled/rejected appointments free the slot back up
const BLOCKING_STATUSES = ["pending", "confirmed"];

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createAppointment(data, { session } = {}) {
  const [appointment] = await Appointment.create([data], { session });
  return appointment;
}

export async function findAppointmentById(id, { populateFields = [], session } = {}) {
  let query = Appointment.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findAppointments({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [
    { path: "user", select: "firstName lastName email phone" },
    { path: "service", select: "name slug" },
    { path: "employee", populate: { path: "userId", select: "firstName lastName" } },
    { path: "assignedTo", populate: { path: "userId", select: "firstName lastName" } },
  ],
  session,
} = {}) {
  const filter = buildAppointmentFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Appointment.find(filter)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    Appointment.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

/**
 * Every busy interval for one employee within [rangeStart, rangeEnd), regardless of
 * whether they're the direct `employee` or the system-`assignedTo` therapist. This is
 * the direct input to the availability engine's slot-subtraction step — it returns the
 * raw list of {startTime, endTime}, not a boolean, so the caller can subtract many
 * intervals from the working-hours grid at once instead of querying per candidate slot.
 */
export async function findBusyIntervals(employeeId, rangeStart, rangeEnd, { session } = {}) {
  return Appointment.find({
    $or: [{ employee: employeeId }, { assignedTo: employeeId }],
    status: { $in: BLOCKING_STATUSES },
    startTime: { $lt: rangeEnd },
    endTime: { $gt: rangeStart },
  })
    .select("startTime endTime")
    .session(session || null)
    .lean();
}

/**
 * Write-time race guard — re-checked right before the transactional insert in case two
 * people booked the same slot within seconds of each other off the same availability list.
 */
export async function findOverlappingAppointments(employeeId, startTime, endTime, excludeId = null, { session } = {}) {
  if (!employeeId) return [];
  const filter = {
    $or: [{ employee: employeeId }, { assignedTo: employeeId }],
    status: { $in: BLOCKING_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Appointment.find(filter).session(session || null).lean();
}

export async function findAppointmentsByUser(userId, options = {}) {
  const { populateFields, session, ...rest } = options;
  return findAppointments({
    ...rest,
    filters: { ...(rest.filters || {}), userId },
    populateFields: populateFields || [
      { path: "service", select: "name slug" },
      { path: "employee", populate: { path: "userId", select: "firstName lastName" } },
    ],
    session,
  });
}

export async function findAppointmentsByEmployee(employeeId, options = {}) {
  const { populateFields, session, ...rest } = options;
  return findAppointments({
    ...rest,
    filters: { ...(rest.filters || {}), employeeId },
    populateFields: populateFields || [
      { path: "user", select: "firstName lastName email" },
      { path: "service", select: "name" },
    ],
    session,
  });
}

export async function updateAppointmentById(id, updateData, { session } = {}) {
  return Appointment.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteAppointmentById(id, { session } = {}) {
  return Appointment.findByIdAndDelete(id, { session }).lean();
}

export async function countAppointments(filters = {}, { session } = {}) {
  return Appointment.countDocuments(buildAppointmentFilter(filters)).session(session || null);
}