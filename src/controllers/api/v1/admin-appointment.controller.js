import appointmentService from "../../../services/appointment.service.js";
import availabilityService from "../../../services/availability.service.js";
import * as packagePurchaseService from "../../../services/package-purchase.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { AppError } from "../../../utils/error.util.js";
import { getStartOfDayInZone, nextDayStartInZone } from "../../../utils/date.time.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";
import { createEntityActionFactory } from "../../../utils/admin-entity-action.util.js";

// Mirrors controllers/web/admin/appointment/{appointment,manual-appointment}
// .controller.js - same services, same audit log entries.

export async function listAppointments(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo, unassignedOnly, page = 1, limit = 10 } = req.query;
    const result = await appointmentService.findAppointments({
      search: search || "",
      role: "admin",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? getStartOfDayInZone(dateFrom) : undefined,
        dateTo: dateTo ? nextDayStartInZone(dateTo) : undefined,
        unassignedOnly: unassignedOnly === "true",
      },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listAppointments] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.getAppointmentById(appointmentId, req.user.id, "admin");

    // Same "eligible employees" narrowing the web detail page does - who'd
    // actually pass reassignAppointment's own validation (on shift, not double-
    // booked), not just anyone capable of the service. A failure here shouldn't
    // take down the whole response - eligibleEmployeeIds just comes back empty.
    let eligibleEmployeeIds = [];
    if (appointment.usluga.id) {
      try {
        eligibleEmployeeIds = await availabilityService.getEligibleEmployeeIdsForAppointment(
          appointment.usluga.id,
          appointment.termin.pocetakRaw,
          appointment.termin.krajRaw,
          appointmentId
        );
      } catch (eligibilityError) {
        logError("[api/admin/getAppointment] Greška pri računanju dostupnih terapeuta", eligibilityError, { appointmentId });
      }
    }

    return res.json({ success: true, data: { ...appointment, eligibleEmployeeIds } });
  } catch (error) {
    logError("[api/admin/getAppointment] Greška", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

const appointmentAction = createEntityActionFactory({
  logPrefix: "api/admin",
  entityType: "Appointment",
  entityLabel: "Termin",
  idParam: "appointmentId",
});

export const confirmAppointment = appointmentAction(
  "confirmAppointment", "APPOINTMENT_CONFIRMED",
  (id, req) => appointmentService.confirmAppointment(id, req.user.id, "admin"),
  "Termin je potvrđen."
);
export const rejectAppointment = appointmentAction(
  "rejectAppointment", "APPOINTMENT_REJECTED",
  (id, req) => appointmentService.rejectAppointment(id, req.body.reason, req.user.id, "admin"),
  "Termin je odbijen."
);
export const cancelAppointment = appointmentAction(
  "cancelAppointment", "APPOINTMENT_CANCELLED",
  (id, req) => appointmentService.cancelAppointment(id, req.body.reason, req.user.id, "admin"),
  "Termin je otkazan."
);
export const completeAppointment = appointmentAction(
  "completeAppointment", "APPOINTMENT_COMPLETED",
  (id, req) => appointmentService.completeAppointment(id, req.user.id, "admin"),
  "Termin je označen kao završen."
);
export const noShowAppointment = appointmentAction(
  "noShowAppointment", "APPOINTMENT_NO_SHOW",
  (id, req) => appointmentService.noShowAppointment(id, req.body.note, req.user.id, "admin"),
  "Termin je označen kao 'klijent se nije pojavio'."
);
export const reopenAppointment = appointmentAction(
  "reopenAppointment", "APPOINTMENT_REOPENED",
  (id, req) => appointmentService.reopenAppointment(id, req.user.id, "admin"),
  "Termin je ponovo otvoren."
);

export async function reassignAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.reassignAppointment(appointmentId, req.body.employeeId, req.user.id);
    logInfo(`[api/admin/reassignAppointment] Termin #${appointmentId} preraspoređen`, { appointmentId, newEmployeeId: req.body.employeeId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "APPOINTMENT_REASSIGNED", entity: { type: "Appointment", id: appointmentId } });
    return res.json({ success: true, data: { message: "Termin je preraspoređen." } });
  } catch (error) {
    logError("[api/admin/reassignAppointment] Greška", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const updated = await appointmentService.rescheduleAppointment(appointmentId, req.body.newStartTime, req.user.id, "admin");
    logInfo(`[api/admin/rescheduleAppointment] Termin #${appointmentId} pomeren`, { appointmentId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "APPOINTMENT_RESCHEDULED", entity: { type: "Appointment", id: appointmentId } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/rescheduleAppointment] Greška", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

export async function deleteAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    // Snapshot before the delete - nothing left to read once deleteAppointmentById returns.
    const existing = await appointmentService.getAppointmentById(appointmentId, req.user.id, "admin").catch(() => null);
    await appointmentService.deleteAppointmentById(appointmentId, req.user.id);
    logInfo(`[api/admin/deleteAppointment] Termin #${appointmentId} obrisan`, { appointmentId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "APPOINTMENT_DELETED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { status: { old: existing?.status || null, new: null }, pocetak: { old: existing?.termin?.pocetakRaw ?? null, new: null } },
    });
    return res.json({ success: true, data: { message: "Termin je obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteAppointment] Greška", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

export async function createManualAppointment(req, res, next) {
  const { serviceId, servicePackageId, employeeId, startTime, existingUserId, firstName, lastName, email, phone, note, priceOverride, packagePurchaseId } = req.body;

  try {
    const { appointment } = await appointmentService.createManualAppointment(
      {
        serviceId,
        servicePackageId,
        employeeId: employeeId || null,
        // An API client sends a full ISO instant (e.g. from its own date picker's
        // toISOString()), not a naive <input type="datetime-local"> string - unlike
        // the web form, there's no ambiguous-timezone string here to resolve, so
        // this is a plain `new Date()`, not zonedInputToUtcDate.
        startTime: new Date(startTime),
        existingUserId: existingUserId || null,
        contact: { firstName, lastName, email, phone },
        note: note || "",
        priceOverride: priceOverride != null ? parseFloat(priceOverride) : null,
        packagePurchaseId: priceOverride != null ? null : packagePurchaseId || null,
      },
      { actorId: req.user.id, actorRole: req.user.roleName === "admin" ? "admin" : "employee" }
    );

    logInfo(`[api/admin/createManualAppointment] Termin ručno kreiran za "${email}"`, { appointmentId: appointment.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "APPOINTMENT_MANUALLY_CREATED",
      entity: { type: "Appointment", id: appointment.id },
      changes: { serviceId: { old: null, new: serviceId }, priceOverride: { old: null, new: priceOverride ?? null } },
    });

    return res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    logError("[api/admin/createManualAppointment] Greška", error, { body: req.body });
    next(error);
  }
}

// AJAX-style check backing the manual-creation flow's "pay from an existing
// package" option - never trusted as authorization on its own (bookAppointment/
// assertUsablePurchase re-checks for real at actual creation time), just decides
// whether to offer the option.
export async function checkManualAppointmentPackage(req, res, next) {
  try {
    const { existingUserId, servicePackageId } = req.body;
    if (!existingUserId || !servicePackageId) {
      return next(new AppError("Korisnik i varijanta su obavezni", 400));
    }

    const purchase = await packagePurchaseService.findUsablePurchaseForService(existingUserId, servicePackageId);
    if (!purchase) return res.json({ success: true, data: { usable: false } });

    const item = (purchase.items || []).find((i) => String(i.servicePackageId) === String(servicePackageId));
    const remainingSessions = item ? item.sessionsTotal - item.sessionsUsed - (item.sessionsReserved || 0) : 0;

    return res.json({ success: true, data: { usable: true, packagePurchaseId: purchase._id.toString(), remainingSessions } });
  } catch (error) {
    logError("[api/admin/checkManualAppointmentPackage] Greška", error, { body: req.body });
    next(error);
  }
}

export default {
  listAppointments, getAppointment,
  confirmAppointment, rejectAppointment, cancelAppointment, completeAppointment, noShowAppointment, reopenAppointment,
  reassignAppointment, rescheduleAppointment, deleteAppointment,
  createManualAppointment, checkManualAppointmentPackage,
};
