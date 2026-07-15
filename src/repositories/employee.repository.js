import Employee from "../models/employee.model.js";
import { buildEmployeeFilter } from "./filters/employee.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createEmployee(data, { session } = {}) {
  const [employee] = await Employee.create([data], { session });
  return employee;
}

export async function findEmployeeById(id, { populateFields = [], session } = {}) {
  let query = Employee.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findEmployeeByUserId(userId, { populateFields = [], session } = {}) {
  let query = Employee.findOne({ userId }).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

// used by the availability engine to find every employee who can perform a given
// service, and by the admin appointment-assignment dropdown (which passes
// populateFields to get display names)
export async function findEmployeesByService(serviceId, { onlyActive = true, populateFields = [], session } = {}) {
  const filter = { services: serviceId };
  if (onlyActive) filter.isActive = true;
  let query = Employee.find(filter).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findEmployees({
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "userId", select: "firstName lastName email phone" }],
  session,
} = {}) {
  const filter = buildEmployeeFilter(filters);
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = Employee.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    Employee.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateEmployeeById(id, updateData, { session } = {}) {
  return Employee.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteEmployeeById(id, { session } = {}) {
  return Employee.findByIdAndDelete(id, { session }).lean();
}

export async function countEmployees(filters = {}, { session } = {}) {
  return Employee.countDocuments(buildEmployeeFilter(filters)).session(session || null);
}

export default {
  createEmployee,
  findEmployeeById,
  findEmployeeByUserId,
  findEmployeesByService,
  findEmployees,
  updateEmployeeById,
  deleteEmployeeById,
  countEmployees,
}