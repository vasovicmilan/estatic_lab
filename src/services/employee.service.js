import employeeRepo from "../repositories/employee.repository.js";
import userRepo from "../repositories/user.repository.js";
import roleService from "./role.service.js";
import { mapEmployee, mapEmployeesForAdminList, mapEmployeeForEdit } from "../mappers/employee.mapper.js";
import { validationError, notFound, conflict, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validateWorkingHours(workingHours = []) {
  for (const wh of workingHours) {
    if (!DAY_ORDER.includes(wh.day)) badRequest(`Nepoznat dan: ${wh.day}`);
    const slots = [...(wh.slots || [])].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!TIME_RE.test(slot.from) || !TIME_RE.test(slot.to)) badRequest(`Neispravan format vremena za ${wh.day}`);
      if (slot.from >= slot.to) badRequest(`Termin ${slot.from}-${slot.to} nije validan (${wh.day})`);
      if (i > 0 && slot.from < slots[i - 1].to) badRequest(`Preklapajući termini u radnom vremenu (${wh.day})`);
    }
  }
}

const defaultPopulate = [
  { path: "userId", select: "firstName lastName email phone" },
  { path: "expert", select: "firstName lastName slug" },
  { path: "services", select: "name" },
];

export async function listEmployees({ limit = 10, page = 1, filters = {}, role = "admin" } = {}) {
  const result = await employeeRepo.findEmployees({ limit, page, filters, populateFields: defaultPopulate });
  return {
    data: role === "admin" ?
      mapEmployeesForAdminList(result.data) : result.data.map((e) => mapEmployee(e, role, "short")),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getEmployeeById(employeeId, role = "admin", viewType = "detail") {
  if (!employeeId) validationError("employeeId");
  const employee = await employeeRepo.findEmployeeById(employeeId, { populateFields: defaultPopulate });
  if (!employee) notFound("Zaposleni");
  return mapEmployee(employee, role, viewType);
}

// raw-shaped (IDs, not display strings) — used to pre-fill the admin edit form,
// as opposed to getEmployeeById(..., "admin", "detail") which formats for display
export async function getEmployeeForEdit(employeeId) {
  if (!employeeId) validationError("employeeId");
  const employee = await employeeRepo.findEmployeeById(employeeId, { populateFields: defaultPopulate });
  if (!employee) notFound("Zaposleni");
  return mapEmployeeForEdit(employee);
}

export async function findEmployeeByUserId(userId) {
  if (!userId) validationError("userId");
  return employeeRepo.findEmployeeByUserId(userId, { populateFields: defaultPopulate });
}

export async function findEmployeeProfile(userId, role = "employee") {
  const employee = await findEmployeeByUserId(userId);
  if (!employee) notFound("Profil zaposlenog");
  return mapEmployee(employee, role, "detail");
}

// creates the Employee record AND promotes the target User's role to "employee"
export async function createEmployee(data) {
  if (!data) validationError("data");
  if (!data.userId) validationError("userId");
  if (data.workingHours) validateWorkingHours(data.workingHours);

  const existing = await employeeRepo.findEmployeeByUserId(data.userId);
  if (existing) conflict("Ovaj korisnik već ima profil zaposlenog");

  const employeeRole = await roleService.findRoleByName("employee");
  if (!employeeRole) badRequest("Rola 'employee' nije konfigurisana");

  const created = await employeeRepo.createEmployee({
    userId: data.userId,
    expert: data.expert || null,
    services: data.services || [],
    workingHours: data.workingHours || [],
    isActive: data.isActive ?? true,
    notes: data.notes || "",
  });

  await userRepo.updateUserById(data.userId, { role: employeeRole._id });

  logInfo("Employee created", { employeeId: created._id, userId: data.userId });
  return getEmployeeById(created._id);
}

export async function updateEmployeeById(employeeId, data) {
  if (!employeeId) validationError("employeeId");
  if (data.workingHours) validateWorkingHours(data.workingHours);

  const updated = await employeeRepo.updateEmployeeById(employeeId, data);
  if (!updated) notFound("Zaposleni");
  logInfo("Employee updated", { employeeId, updatedFields: Object.keys(data) });
  return getEmployeeById(employeeId);
}

export async function manageWorkingHours(employeeId, workingHours, requesterId, requesterRole) {
  if (!employeeId) validationError("employeeId");
  validateWorkingHours(workingHours);

  const employee = await employeeRepo.findEmployeeById(employeeId);
  if (!employee) notFound("Zaposleni");

  if (requesterRole !== "admin") {
    const ownerId = employee.userId?.toString();
    if (ownerId !== String(requesterId)) forbidden("Nemate pravo da menjate radno vreme drugog zaposlenog");
  }

  const updated = await employeeRepo.updateEmployeeById(employeeId, { workingHours });
  logInfo("Employee working hours updated", { employeeId, updatedBy: requesterId });
  return getEmployeeById(updated._id);
}

export async function deleteEmployeeById(employeeId) {
  if (!employeeId) validationError("employeeId");
  const existing = await employeeRepo.findEmployeeById(employeeId);
  if (!existing) notFound("Zaposleni");
  await employeeRepo.deleteEmployeeById(employeeId);
  logInfo("Employee deleted", { employeeId });
  return { success: true };
}

// raw (unmapped) — used internally by the availability engine
export async function findEmployeesByServiceRaw(serviceId) {
  if (!serviceId) validationError("serviceId");
  return employeeRepo.findEmployeesByService(serviceId);
}

export default {
  listEmployees,
  getEmployeeById,
  getEmployeeForEdit,
  findEmployeeByUserId,
  findEmployeeProfile,
  createEmployee,
  updateEmployeeById,
  manageWorkingHours,
  deleteEmployeeById,
  findEmployeesByServiceRaw,
};