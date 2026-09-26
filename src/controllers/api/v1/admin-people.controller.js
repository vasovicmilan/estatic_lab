import * as userService from "../../../services/user.service.js";
import * as authService from "../../../services/auth.service.js";
import * as roleService from "../../../services/role.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as expertService from "../../../services/expert.service.js";
import partnerService from "../../../services/partner.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Mirrors controllers/web/admin/auth/{user,employee,expert,partner}.controller.js -
// same services, same audit log entries. No /dodavanje or /izmena/:id form-page
// routes (see admin-taxonomy.controller.js's header comment - same reasoning).
// Expert.image is required at the DB level (ImageSchema, no default) - since this
// API doesn't handle multipart file upload, a client creating/updating an expert's
// photo passes image: { img, imgDesc } directly (an already-hosted path/URL,
// exactly what ImageSchema stores) rather than uploading raw bytes here.

// ---- Users ----

export async function listUsers(req, res, next) {
  try {
    const { search, status, role, provider, page = 1, limit = 10 } = req.query;
    const result = await userService.listUsers({
      search: search || "",
      status: status || undefined,
      role: role || undefined,
      provider: provider || undefined,
      excludeUserId: req.user.id,
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listUsers] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.userId);
    return res.json({ success: true, data: user });
  } catch (error) {
    logError("[api/admin/getUser] Greška", error, { userId: req.params.userId });
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const updated = await userService.updateProfile(userId, req.body);
    logInfo(`[api/admin/updateUser] Korisnik #${userId} ažuriran od strane admina`, { userId, adminId: req.user.id });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateUser] Greška", error, { userId: req.params.userId, body: req.body });
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;
    const existing = await userService.getUserById(userId).catch(() => null);
    await userService.updateUserStatus(userId, req.body.status);
    logInfo(`[api/admin/updateUserStatus] Status korisnika #${userId} promenjen na "${req.body.status}"`, { userId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "USER_STATUS_CHANGED",
      entity: { type: "User", id: userId },
      changes: { status: { old: existing?.statusRaw || null, new: req.body.status } },
    });
    return res.json({ success: true, data: { message: "Status korisnika je promenjen." } });
  } catch (error) {
    logError("[api/admin/updateUserStatus] Greška", error, { userId: req.params.userId, requestedStatus: req.body.status });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), success: false, errorMessage: error.message, action: "USER_STATUS_CHANGED", entity: { type: "User", id: req.params.userId } });
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const existing = await userService.getUserById(userId).catch(() => null);
    await userService.updateUserRole(userId, req.body.role);
    logInfo(`[api/admin/updateUserRole] Rola korisnika #${userId} promenjena`, { userId, newRole: req.body.role, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "USER_ROLE_CHANGED",
      entity: { type: "User", id: userId },
      changes: { roleId: { old: existing?.roleId || null, new: req.body.role } },
    });
    return res.json({ success: true, data: { message: "Rola korisnika je promenjena." } });
  } catch (error) {
    logError("[api/admin/updateUserRole] Greška", error, { userId: req.params.userId, requestedRole: req.body.role });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), success: false, errorMessage: error.message, action: "USER_ROLE_CHANGED", entity: { type: "User", id: req.params.userId } });
    next(error);
  }
}

export async function verifyUser(req, res, next) {
  try {
    const { userId } = req.params;
    await authService.verifyAccountByAdmin(userId);
    logInfo(`[api/admin/verifyUser] Korisnik #${userId} ručno verifikovan`, { userId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "USER_VERIFIED_BY_ADMIN", entity: { type: "User", id: userId } });
    return res.json({ success: true, data: { message: "Nalog je verifikovan." } });
  } catch (error) {
    logError("[api/admin/verifyUser] Greška", error, { userId: req.params.userId });
    next(error);
  }
}

export async function anonymizeUser(req, res, next) {
  try {
    const { userId } = req.params;
    const existing = await userService.getUserById(userId).catch(() => null);
    await userService.anonymizeUser(userId);
    logInfo(`[api/admin/anonymizeUser] Korisnik #${userId} anonimizovan`, { userId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "USER_ANONYMIZED",
      entity: { type: "User", id: userId },
      changes: { email: { old: existing?.email || null, new: null } },
    });
    return res.json({ success: true, data: { message: "Nalog je anonimizovan." } });
  } catch (error) {
    logError("[api/admin/anonymizeUser] Greška", error, { userId: req.params.userId });
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    const existing = await userService.getUserById(userId).catch(() => null);
    await userService.deleteUser(userId);
    logInfo(`[api/admin/deleteUser] Korisnik #${userId} obrisan`, { userId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "USER_DELETED",
      entity: { type: "User", id: userId },
      changes: { email: { old: existing?.email || null, new: null } },
    });
    return res.json({ success: true, data: { message: "Korisnik je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteUser] Greška", error, { userId: req.params.userId });
    next(error);
  }
}

// ---- Employees ----

export async function listEmployees(req, res, next) {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    const result = await employeeService.listEmployees({
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listEmployees] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getEmployee(req, res, next) {
  try {
    const employee = await employeeService.getEmployeeById(req.params.employeeId, "admin", "detail");
    return res.json({ success: true, data: employee });
  } catch (error) {
    logError("[api/admin/getEmployee] Greška", error, { employeeId: req.params.employeeId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as getExpertForEdit/getProductForEdit/
// getPackageForEdit above. employeeService.getEmployeeForEdit already existed
// (used internally by updateEmployee's before/after audit diff) but had no
// route wired to it - purely additive, getEmployee's existing response is
// unchanged.
export async function getEmployeeForEdit(req, res, next) {
  try {
    const employee = await employeeService.getEmployeeForEdit(req.params.employeeId);
    return res.json({ success: true, data: employee });
  } catch (error) {
    logError("[api/admin/getEmployeeForEdit] Greška", error, { employeeId: req.params.employeeId });
    next(error);
  }
}

export async function createEmployee(req, res, next) {
  try {
    const employee = await employeeService.createEmployee(req.body);
    logInfo(`[api/admin/createEmployee] Zaposleni kreiran za korisnika #${req.body.userId}`, { employeeId: employee.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "EMPLOYEE_CREATED",
      entity: { type: "Employee", id: employee.id },
      changes: { userId: { old: null, new: req.body.userId }, payType: { old: null, new: req.body.payType || null } },
    });
    return res.status(201).json({ success: true, data: employee });
  } catch (error) {
    logError("[api/admin/createEmployee] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateEmployee(req, res, next) {
  try {
    const { employeeId } = req.params;
    const existing = await employeeService.getEmployeeForEdit(employeeId);
    const updated = await employeeService.updateEmployeeById(employeeId, req.body);
    logInfo(`[api/admin/updateEmployee] Zaposleni #${employeeId} ažuriran`, { employeeId, adminId: req.user.id });

    const afterUpdate = await employeeService.getEmployeeForEdit(employeeId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["payType", "commissionRate", "isActive"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "EMPLOYEE_UPDATED", entity: { type: "Employee", id: employeeId }, changes });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateEmployee] Greška", error, { employeeId: req.params.employeeId, body: req.body });
    next(error);
  }
}

export async function updateEmployeeWorkingHours(req, res, next) {
  try {
    const { employeeId } = req.params;
    await employeeService.manageWorkingHours(employeeId, req.body.workingHours || [], req.user.id, req.user.roleName);
    logInfo(`[api/admin/updateEmployeeWorkingHours] Radno vreme zaposlenog #${employeeId} ažurirano`, { employeeId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "EMPLOYEE_WORKING_HOURS_UPDATED", entity: { type: "Employee", id: employeeId } });
    return res.json({ success: true, data: { message: "Radno vreme je ažurirano." } });
  } catch (error) {
    logError("[api/admin/updateEmployeeWorkingHours] Greška", error, { employeeId: req.params.employeeId });
    next(error);
  }
}

export async function deleteEmployee(req, res, next) {
  try {
    const { employeeId } = req.params;
    const existing = await employeeService.getEmployeeForEdit(employeeId).catch(() => null);
    await employeeService.deleteEmployeeById(employeeId);
    logInfo(`[api/admin/deleteEmployee] Zaposleni #${employeeId} obrisan`, { employeeId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "EMPLOYEE_DELETED",
      entity: { type: "Employee", id: employeeId },
      changes: { imePrezime: { old: existing?.imePrezime || null, new: null } },
    });
    return res.json({ success: true, data: { message: "Zaposleni je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteEmployee] Greška", error, { employeeId: req.params.employeeId });
    next(error);
  }
}

// ---- Experts ----

export async function listExperts(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await expertService.listExperts({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listExperts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getExpert(req, res, next) {
  try {
    const expert = await expertService.getExpertById(req.params.expertId);
    return res.json({ success: true, data: expert });
  } catch (error) {
    logError("[api/admin/getExpert] Greška", error, { expertId: req.params.expertId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as admin-catalog.controller.js's
// getPackageForEdit/getProductForEdit. expertService.getExpertForEdit already
// existed (mapExpertForEdit, English-keyed, raw values) but had no route wired
// to it - this is purely additive, getExpert's existing response is unchanged.
export async function getExpertForEdit(req, res, next) {
  try {
    const expert = await expertService.getExpertForEdit(req.params.expertId);
    return res.json({ success: true, data: expert });
  } catch (error) {
    logError("[api/admin/getExpertForEdit] Greška", error, { expertId: req.params.expertId });
    next(error);
  }
}

export async function createExpert(req, res, next) {
  try {
    const data = { ...req.body };
    data.services = Array.isArray(req.body.services) ? req.body.services.filter(Boolean) : [];
    // image must be a { img, imgDesc } object the client already hosted - see this
    // file's header comment. Expert.image is required at the DB level with no
    // default, so an omitted image throws a clear Mongoose validation error here.
    const expert = await expertService.createExpert(data);
    logInfo(`[api/admin/createExpert] Ekspert kreiran: "${expert.osnovno.ime} ${expert.osnovno.prezime}"`, { expertId: expert.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "EXPERT_CREATED", entity: { type: "Expert", id: expert.id } });
    return res.status(201).json({ success: true, data: expert });
  } catch (error) {
    logError("[api/admin/createExpert] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateExpert(req, res, next) {
  try {
    const { expertId } = req.params;
    const data = { ...req.body };
    if (req.body.services) data.services = Array.isArray(req.body.services) ? req.body.services.filter(Boolean) : [];
    const expert = await expertService.updateExpertById(expertId, data);
    logInfo(`[api/admin/updateExpert] Ekspert #${expertId} ažuriran`, { expertId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "EXPERT_UPDATED", entity: { type: "Expert", id: expertId } });
    return res.json({ success: true, data: expert });
  } catch (error) {
    logError("[api/admin/updateExpert] Greška", error, { expertId: req.params.expertId, body: req.body });
    next(error);
  }
}

export async function deleteExpert(req, res, next) {
  try {
    const { expertId } = req.params;
    // Snapshot before the delete - nothing left to read once deleteExpertById returns.
    const existing = await expertService.getExpertForEdit(expertId).catch(() => null);
    await expertService.deleteExpertById(expertId);
    logInfo(`[api/admin/deleteExpert] Ekspert #${expertId} obrisan`, { expertId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "EXPERT_DELETED",
      entity: { type: "Expert", id: expertId },
      changes: {
        imePrezime: { old: existing ? `${existing.firstName || ""} ${existing.lastName || ""}`.trim() : null, new: null },
      },
    });
    return res.json({ success: true, data: { message: "Ekspert je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteExpert] Greška", error, { expertId: req.params.expertId });
    next(error);
  }
}

// ---- Partners ----

export async function listPartners(req, res, next) {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;
    const result = await partnerService.listPartners({
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listPartners] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPartner(req, res, next) {
  try {
    const partner = await partnerService.getPartnerById(req.params.partnerId, "admin", "detail");
    return res.json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/getPartner] Greška", error, { partnerId: req.params.partnerId });
    next(error);
  }
}

// Raw/edit shape - same reasoning as getEmployeeForEdit/getExpertForEdit above.
// partnerService.getPartnerForEdit already existed (mapPartnerForEdit, raw
// userId instead of display strings) but had no route wired to it.
export async function getPartnerForEdit(req, res, next) {
  try {
    const partner = await partnerService.getPartnerForEdit(req.params.partnerId);
    return res.json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/getPartnerForEdit] Greška", error, { partnerId: req.params.partnerId });
    next(error);
  }
}

export async function createPartner(req, res, next) {
  try {
    const partner = await partnerService.createPartner(req.body);
    logInfo(`[api/admin/createPartner] Partner kreiran za korisnika #${req.body.userId}`, { partnerId: partner.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PARTNER_CREATED", entity: { type: "Partner", id: partner.id } });
    return res.status(201).json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/createPartner] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updatePartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await partnerService.updatePartnerById(partnerId, req.body);
    logInfo(`[api/admin/updatePartner] Partner #${partnerId} ažuriran`, { partnerId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PARTNER_UPDATED", entity: { type: "Partner", id: partnerId } });
    return res.json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/updatePartner] Greška", error, { partnerId: req.params.partnerId, body: req.body });
    next(error);
  }
}

export async function deletePartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    // Snapshot before the delete - nothing left to read once deletePartnerById returns.
    const existing = await partnerService.getPartnerForEdit(partnerId).catch(() => null);
    await partnerService.deletePartnerById(partnerId);
    logInfo(`[api/admin/deletePartner] Partner #${partnerId} obrisan`, { partnerId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "PARTNER_DELETED",
      entity: { type: "Partner", id: partnerId },
      changes: { imePrezime: { old: existing?.imePrezime || null, new: null } },
    });
    return res.json({ success: true, data: { message: "Partner je obrisan." } });
  } catch (error) {
    logError("[api/admin/deletePartner] Greška", error, { partnerId: req.params.partnerId });
    next(error);
  }
}

export default {
  listUsers, getUser, updateUser, updateUserStatus, updateUserRole, verifyUser, anonymizeUser, deleteUser,
  listEmployees, getEmployee, getEmployeeForEdit, createEmployee, updateEmployee, updateEmployeeWorkingHours, deleteEmployee,
  listExperts, getExpert, getExpertForEdit, createExpert, updateExpert, deleteExpert,
  listPartners, getPartner, getPartnerForEdit, createPartner, updatePartner, deletePartner,
};
