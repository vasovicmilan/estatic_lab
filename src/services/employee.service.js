import employeeRepo from "../repositories/employee.repository.js";
import appointmentRepo from "../repositories/appointment.repository.js";
import commissionEntryRepo from "../repositories/commission-entry.repository.js";
import payoutRequestRepo from "../repositories/payout-request.repository.js";
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

// raw-shaped (IDs, not display strings) - used to pre-fill the admin edit form,
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
    googleCalendarId: data.googleCalendarId || null,
    sredimeIcsUrl: data.sredimeIcsUrl || null,
  });

  // Only promote the user's role to "employee" - never downgrade someone who
  // already holds a role of equal or higher priority (e.g. admin). Without this
  // check, giving an admin an employee profile silently stripped their admin
  // role, since role is a single field on User, not a set of roles.
  const targetUser = await userRepo.findUserById(data.userId, { populateFields: ["role"] });
  const currentPriority = targetUser?.role?.priority ?? 0;
  if (currentPriority < employeeRole.priority) {
    await userRepo.updateUserById(data.userId, { role: employeeRole._id });
  } else {
    logInfo("Employee profile created without changing role (existing role has equal/higher priority)", {
      userId: data.userId,
      currentRole: targetUser?.role?.name,
    });
  }

  logInfo("Employee created", { employeeId: created._id, userId: data.userId });
  return getEmployeeById(created._id);
}

export async function updateEmployeeById(employeeId, data) {
  if (!employeeId) validationError("employeeId");
  if (data.workingHours) validateWorkingHours(data.workingHours);

  // Mirror createEmployee's sanitization - an unselected <select name="expert">
  // submits "" (falsy), which the validator correctly lets through since expert
  // is optional, but Mongoose can't cast "" to an ObjectId. Same defensive
  // treatment for services in case something upstream ever sends a stray "".
  const sanitized = {
    ...data,
    expert: data.expert || null,
    ...(data.services ? { services: data.services.filter(Boolean) } : {}),
  };

  const updated = await employeeRepo.updateEmployeeById(employeeId, sanitized);
  if (!updated) notFound("Zaposleni");
  logInfo("Employee updated", { employeeId, updatedFields: Object.keys(sanitized) });
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

  const [activeAppointments, pendingCommissions, unresolvedPayouts] = await Promise.all([
    appointmentRepo.countAppointments({ employeeId, statusIn: ["pending", "confirmed"] }),
    commissionEntryRepo.countCommissionEntries({ employee: employeeId, status: "pending" }),
    payoutRequestRepo.countPayoutRequests({ employee: employeeId, statusIn: ["requested", "approved"] }),
  ]);

  if (activeAppointments > 0) {
    badRequest("Zaposleni ima termine na čekanju ili potvrđene termine - ne može biti obrisan. Deaktivirajte nalog umesto brisanja.");
  }
  if (pendingCommissions > 0) {
    badRequest("Zaposleni ima proviziju na čekanju koja još nije obračunata - ne može biti obrisan. Deaktivirajte nalog umesto brisanja.");
  }
  if (unresolvedPayouts > 0) {
    badRequest("Zaposleni ima zahtev za isplatu koji još nije rešen - ne može biti obrisan. Deaktivirajte nalog umesto brisanja.");
  }

  await employeeRepo.deleteEmployeeById(employeeId);
  logInfo("Employee deleted", { employeeId });
  return { success: true };
}

// raw (unmapped) - used internally by the availability engine
export async function findEmployeesByServiceRaw(serviceId, { session } = {}) {
  if (!serviceId) validationError("serviceId");
  return employeeRepo.findEmployeesByService(serviceId, { session });
}

// raw (unmapped) single employee, for availability.service.js's internal use -
// needs workingHours directly, which no mapped shape exposes in the right form
export async function getEmployeeByIdRaw(employeeId) {
  if (!employeeId) validationError("employeeId");
  return employeeRepo.findEmployeeById(employeeId);
}

// {id, name} pairs for the admin appointment-assignment dropdown - only employees
// who can actually perform this specific service
export async function getEmployeeOptionsForService(serviceId) {
  if (!serviceId) validationError("serviceId");
  const employees = await employeeRepo.findEmployeesByService(serviceId, {
    populateFields: [{ path: "userId", select: "firstName lastName" }],
  });
  return employees.map((e) => ({
    id: e._id.toString(),
    name: `${e.userId?.firstName || ""} ${e.userId?.lastName || ""}`.trim() || "Nepoznato",
  }));
}

export async function getEmployeeNameById(employeeId) {
  if (!employeeId) return null;
  const employee = await employeeRepo.findEmployeeById(employeeId, {
    populateFields: [{ path: "userId", select: "firstName lastName" }],
  });
  if (!employee) return null;
  return `${employee.userId?.firstName || ""} ${employee.userId?.lastName || ""}`.trim() || null;
}

export async function getAllEmployeeUserIds() {
  return employeeRepo.findAllEmployeeUserIds();
}

// Used by jobs/sredime-jobs.js - raw (unmapped), same reasoning as
// getEmployeeByIdRaw: the sync job needs sredimeIcsUrl directly, not any
// display-formatted shape.
export async function getEmployeesWithSredimeIcsUrl() {
  return employeeRepo.findEmployeesWithSredimeIcsUrl();
}

// Feeds the site-wide Organization JSON-LD (organization.builder.js). There is no
// fixed salon schedule to hardcode - who's actually here on a given day depends on
// individual employee schedules, which change. So instead of a static config value
// someone has to remember to update, this derives "hours when at least one active
// employee is working" per weekday: earliest opening to latest closing across every
// active employee's workingHours. A day with zero active employees scheduled is
// omitted entirely (interpreted as closed, same schema.org convention as omitting a
// closed day from OpeningHoursSpecification).
//
// Cached in-memory for HOURS_CACHE_TTL_MS: this now runs on every page render (via
// locals.config.js), and schedules don't change often enough to justify a DB round
// trip on every single request.
const HOURS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let hoursCache = { data: null, expiresAt: 0 };

export async function getAggregateBusinessHours() {
  const now = Date.now();
  if (hoursCache.data && hoursCache.expiresAt > now) return hoursCache.data;

  const employees = await employeeRepo.findActiveEmployeesWorkingHours();
  const byDay = {};

  for (const employee of employees) {
    for (const wh of employee.workingHours || []) {
      for (const slot of wh.slots || []) {
        if (!slot.from || !slot.to) continue;
        const existing = byDay[wh.day];
        if (!existing) {
          byDay[wh.day] = { opens: slot.from, closes: slot.to };
        } else {
          if (slot.from < existing.opens) existing.opens = slot.from;
          if (slot.to > existing.closes) existing.closes = slot.to;
        }
      }
    }
  }

  const result = DAY_ORDER.filter((day) => byDay[day]).map((day) => ({
    dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
    opens: byDay[day].opens,
    closes: byDay[day].closes,
  }));

  hoursCache = { data: result, expiresAt: now + HOURS_CACHE_TTL_MS };
  return result;
}

// Test-only: the in-memory cache above is exactly the point in production (avoids
// a DB hit on every page render), but it means test cases in the same process would
// otherwise see each other's cached results. Not used by any app code.
export function _clearAggregateHoursCacheForTests() {
  hoursCache = { data: null, expiresAt: 0 };
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
  getEmployeeByIdRaw,
  getEmployeeOptionsForService,
  getEmployeeNameById,
  getAllEmployeeUserIds,
  getEmployeesWithSredimeIcsUrl,
  getAggregateBusinessHours,
};