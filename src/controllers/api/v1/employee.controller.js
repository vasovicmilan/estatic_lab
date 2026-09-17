import * as employeeService from "../../../services/employee.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import payoutRequestService from "../../../services/payout-request.service.js";
import commissionService from "../../../services/commission.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { getStartOfDayInZone } from "../../../utils/date.time.util.js";

// Mirrors controllers/web/employee/employee.controller.js - same services, same
// audit log actor shape (req.user, not req.session.user). req.user.isEmployee was
// already embedded in the JWT at login (see auth.service.js) - employeeMiddleware
// gates on that before any of these run, so every handler here can assume it's
// talking to a real employee.

async function getOwnEmployee(req) {
  return employeeService.findEmployeeByUserId(req.user.id);
}

function employeeIdOf(employee) {
  return employee?._id?.toString() || employee?.id;
}

function isCommissionBased(employee) {
  return employee?.payType === "commission";
}

export async function dashboard(req, res, next) {
  try {
    const employee = await getOwnEmployee(req);
    const employeeId = employeeIdOf(employee);
    const commissionBased = isCommissionBased(employee);

    const todayStart = getStartOfDayInZone();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [today, week] = await Promise.all([
      appointmentService.findAppointments({ requesterId: employeeId, role: "employee", filters: { dateFrom: todayStart, dateTo: todayEnd }, limit: 50 }),
      appointmentService.findAppointments({ requesterId: employeeId, role: "employee", limit: 50 }),
    ]);

    const pendingCount = week.data.filter((a) => a.status === "Na čekanju").length;

    let balance = null;
    let recentCommissions = [];
    if (commissionBased) {
      balance = await payoutRequestService.getBalance("employee", employeeId);
      const commissionsResult = await commissionService.listCommissionsForEarner({ employee: employeeId, limit: 5 });
      recentCommissions = commissionsResult.data;
    }

    return res.json({
      success: true,
      data: { todayAppointments: today.data, pendingCount, weekAppointments: week.data, isCommissionBased: commissionBased, balance, recentCommissions },
    });
  } catch (error) {
    logError("[api/employee/dashboard] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function listAppointments(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const { status, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      requesterId: employeeId,
      role: "employee",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    logError("[api/employee/listAppointments] Greška", error, { userId: req.user.id, query: req.query });
    next(error);
  }
}

export async function getAppointment(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const appointment = await appointmentService.getAppointmentById(req.params.appointmentId, employeeId, "employee");
    return res.json({ success: true, data: appointment });
  } catch (error) {
    logError("[api/employee/getAppointment] Greška", error, { appointmentId: req.params.appointmentId, userId: req.user.id });
    next(error);
  }
}

function appointmentAction(actionName, auditAction, serviceCallFn, successMessage) {
  return async function (req, res, next) {
    try {
      const { appointmentId } = req.params;
      const employeeId = employeeIdOf(await getOwnEmployee(req));
      await serviceCallFn(appointmentId, employeeId, req);
      logInfo(`[api/employee/${actionName}] Zaposleni izvršio akciju nad terminom #${appointmentId}`, { appointmentId, userId: req.user.id });
      await auditLogService.recordAuditLog({ actor: req.user, action: auditAction, entity: { type: "Appointment", id: appointmentId }, req, success: true });
      return res.json({ success: true, data: { message: successMessage } });
    } catch (error) {
      logError(`[api/employee/${actionName}] Greška`, error, { appointmentId: req.params.appointmentId, userId: req.user.id });
      next(error);
    }
  };
}

export const confirmAppointment = appointmentAction(
  "confirmAppointment",
  "APPOINTMENT_CONFIRMED",
  (id, employeeId) => appointmentService.confirmAppointment(id, employeeId, "employee"),
  "Termin je potvrđen."
);

export const completeAppointment = appointmentAction(
  "completeAppointment",
  "APPOINTMENT_COMPLETED",
  (id, employeeId) => appointmentService.completeAppointment(id, employeeId, "employee"),
  "Termin je označen kao završen."
);

export const rejectAppointment = appointmentAction(
  "rejectAppointment",
  "APPOINTMENT_REJECTED",
  (id, employeeId, req) => appointmentService.rejectAppointment(id, req.body.reason, employeeId, "employee"),
  "Termin je odbijen."
);

export const noShowAppointment = appointmentAction(
  "noShowAppointment",
  "APPOINTMENT_NO_SHOW",
  (id, employeeId, req) => appointmentService.noShowAppointment(id, req.body.note, employeeId, "employee"),
  "Termin je označen kao 'klijent se nije pojavio'."
);

export async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const existing = await appointmentService.getAppointmentById(appointmentId, employeeId, "employee").catch(() => null);
    const updated = await appointmentService.rescheduleAppointment(appointmentId, req.body.newStartTime, employeeId, "employee");

    logInfo(`[api/employee/rescheduleAppointment] Zaposleni pomerio termin #${appointmentId}`, { appointmentId, userId: req.user.id });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "APPOINTMENT_RESCHEDULED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { pocetak: { old: existing?.termin?.pocetakRaw ?? null, new: req.body.newStartTime || null } },
      req,
      success: true,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/employee/rescheduleAppointment] Greška", error, { appointmentId: req.params.appointmentId, userId: req.user.id });
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const employee = await getOwnEmployee(req);
    const employeeProfile = await employeeService.findEmployeeProfile(req.user.id, "employee");
    return res.json({ success: true, data: { ...employeeProfile, isCommissionBased: isCommissionBased(employee) } });
  } catch (error) {
    logError("[api/employee/getProfile] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function updateWorkingHours(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const existingProfile = await employeeService.findEmployeeProfile(req.user.id, "employee").catch(() => null);
    const workingHours = req.body.workingHours || [];
    await employeeService.manageWorkingHours(employeeId, workingHours, req.user.id, "employee");

    logInfo(`[api/employee/updateWorkingHours] Zaposleni #${req.user.id} ažurirao radno vreme`, { userId: req.user.id });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "EMPLOYEE_WORKING_HOURS_UPDATED",
      entity: { type: "Employee", id: employeeId },
      changes: { workingHours: { old: existingProfile?.workingHours ?? null, new: workingHours } },
      req,
      success: true,
    });

    return res.json({ success: true, data: { message: "Radno vreme je uspešno ažurirano." } });
  } catch (error) {
    logError("[api/employee/updateWorkingHours] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function listCommissions(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const { page = 1, limit = 10, status, sourceType } = req.query;

    const result = await commissionService.listCommissionsForEarner({
      employee: employeeId,
      status: status || undefined,
      sourceType: sourceType || undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    logError("[api/employee/listCommissions] Greška", error, { userId: req.user.id, query: req.query });
    next(error);
  }
}

export async function listPayouts(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    const { page = 1, limit = 10, status } = req.query;

    const result = await payoutRequestService.listPayoutRequestsForEarner({
      employee: employeeId,
      status: status || undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    logError("[api/employee/listPayouts] Greška", error, { userId: req.user.id, query: req.query });
    next(error);
  }
}

export async function requestPayout(req, res, next) {
  try {
    const employeeId = employeeIdOf(await getOwnEmployee(req));
    await payoutRequestService.requestPayout("employee", employeeId, Number(req.body.amount));

    logInfo("[api/employee/requestPayout] Zaposleni zatražio isplatu", { employeeId, amount: req.body.amount });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "PAYOUT_REQUESTED",
      entity: { type: "Employee", id: employeeId },
      changes: { amount: { old: null, new: Number(req.body.amount) } },
      req,
      success: true,
    });

    return res.status(201).json({ success: true, data: { message: "Zahtev za isplatu je poslat." } });
  } catch (error) {
    logError("[api/employee/requestPayout] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export default {
  dashboard,
  listAppointments, getAppointment, confirmAppointment, completeAppointment, rejectAppointment, noShowAppointment, rescheduleAppointment,
  getProfile, updateWorkingHours,
  listCommissions, listPayouts, requestPayout,
};
