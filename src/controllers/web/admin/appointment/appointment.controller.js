import * as appointmentService from "../../../../services/appointment.service.js";
import * as employeeService from "../../../../services/employee.service.js";
import availabilityService from "../../../../services/availability.service.js";
import { prepareAppointmentListData, prepareAppointmentDetailsData } from "../../../../presenters/admin/appointment/appointment.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listAppointments(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo, unassignedOnly, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      search: search || "",
      role: "admin",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        unassignedOnly: unassignedOnly === "true",
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareAppointmentListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Termini",
      pageDescription: "Pregled svih termina",
      data: viewData,
    });
  } catch (error) {
    logError("[listAppointments] Greška pri učitavanju liste termina", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function appointmentDetails(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.getAppointmentById(appointmentId, req.session?.user?.id, "admin");

    let employeeOptions = [];
    if (appointment.usluga.id) {
      employeeOptions = await employeeService.getEmployeeOptionsForService(appointment.usluga.id);

      // Narrows the list to employees who'd actually pass reassignAppointment's own
      // validation (on shift + not double-booked), instead of every employee capable
      // of the service - see availability.service.js's getEligibleEmployeeIdsForAppointment.
      // Wrapped separately from the fetch above: if THIS specific computation fails for
      // any reason, the page still renders with the old (unfiltered) behavior instead of
      // taking down appointment details entirely - a worse dropdown is a much smaller
      // problem than an unusable detail page.
      try {
        const eligibleIds = await availabilityService.getEligibleEmployeeIdsForAppointment(
          appointment.usluga.id,
          appointment.termin.pocetakRaw,
          appointment.termin.krajRaw,
          appointmentId
        );
        employeeOptions = employeeOptions.filter((option) => eligibleIds.includes(option.id));
      } catch (eligibilityError) {
        logError("[appointmentDetails] Greška pri filtriranju dostupnih terapeuta - prikazuje se nefiltrirana lista", eligibilityError, {
          appointmentId,
          serviceId: appointment.usluga.id,
        });
      }
    }

    const viewData = prepareAppointmentDetailsData(appointment, { employeeOptions });

    return res.render("admin/_details", {
      pageTitle: `Termin - ${appointment.korisnik.ime}`,
      pageDescription: appointment.usluga.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[appointmentDetails] Greška pri učitavanju detalja termina", error, {
      appointmentId: req.params.appointmentId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function confirmAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.confirmAppointment(appointmentId, req.session?.user?.id, "admin");
    logInfo(`[confirmAppointment] Termin #${appointmentId} potvrđen`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_CONFIRMED",
      entity: { type: "Appointment", id: appointmentId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je uspešno potvrđen", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[confirmAppointment] Greška pri potvrđivanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function rejectAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[rejectAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/termini/detalji/${appointmentId}`);
    }

    await appointmentService.rejectAppointment(appointmentId, req.body.reason, req.session?.user?.id, "admin");
    logInfo(`[rejectAppointment] Termin #${appointmentId} odbijen`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_REJECTED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je odbijen", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[rejectAppointment] Greška pri odbijanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.cancelAppointment(appointmentId, req.body.reason, req.session?.user?.id, "admin");
    logInfo(`[cancelAppointment] Termin #${appointmentId} otkazan od strane admina`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_CANCELLED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je otkazan", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[cancelAppointment] Greška pri otkazivanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function completeAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.completeAppointment(appointmentId, req.session?.user?.id, "admin");
    logInfo(`[completeAppointment] Termin #${appointmentId} označen kao završen`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_COMPLETED",
      entity: { type: "Appointment", id: appointmentId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je označen kao završen", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[completeAppointment] Greška pri završavanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function noShowAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[noShowAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/termini/detalji/${appointmentId}`);
    }

    await appointmentService.noShowAppointment(appointmentId, req.body.note, req.session?.user?.id, "admin");
    logInfo(`[noShowAppointment] Termin #${appointmentId} označen kao 'nije se pojavio'`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_NO_SHOW",
      entity: { type: "Appointment", id: appointmentId },
      changes: { note: { old: null, new: req.body.note || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je označen kao 'klijent se nije pojavio'", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[noShowAppointment] Greška pri označavanju termina kao 'nije se pojavio'", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function reassignAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[reassignAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/termini/detalji/${appointmentId}`);
    }

    const existing = await appointmentService.getAppointmentById(appointmentId, req.session?.user?.id, "admin").catch(() => null);
    await appointmentService.reassignAppointment(appointmentId, req.body.employeeId, req.session?.user?.id);
    logInfo(`[reassignAppointment] Termin #${appointmentId} preraspoređen`, { appointmentId, newEmployeeId: req.body.employeeId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_REASSIGNED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { terapeutId: { old: existing?.terapeutId ?? null, new: req.body.employeeId || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je uspešno preraspoređen", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[reassignAppointment] Greška pri preraspodeli termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[rescheduleAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/termini/detalji/${appointmentId}`);
    }

    const existing = await appointmentService.getAppointmentById(appointmentId, req.session?.user?.id, "admin").catch(() => null);
    await appointmentService.rescheduleAppointment(appointmentId, req.body.newStartTime, req.session?.user?.id, "admin");
    logInfo(`[rescheduleAppointment] Termin #${appointmentId} pomeren od strane admina`, { appointmentId, newStartTime: req.body.newStartTime, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_RESCHEDULED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { pocetak: { old: existing?.termin?.pocetakRaw ?? null, new: req.body.newStartTime || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je pomeren na novo vreme", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[rescheduleAppointment] Greška pri pomeranju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function deleteAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.deleteAppointmentById(appointmentId, req.session?.user?.id);
    logInfo(`[deleteAppointment] Termin #${appointmentId} obrisan`, { appointmentId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_DELETED",
      entity: { type: "Appointment", id: appointmentId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Termin je uspešno obrisan", "/admin/termini");
  } catch (error) {
    logError("[deleteAppointment] Greška pri brisanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/termini");
    }
    next(error);
  }
}

export default {
  listAppointments,
  appointmentDetails,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
  noShowAppointment,
  reassignAppointment,
  rescheduleAppointment,
  deleteAppointment,
};