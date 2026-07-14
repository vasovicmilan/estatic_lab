import * as appointmentService from "../../../../services/appointment.service.js";
import { prepareAppointmentListData, prepareAppointmentDetailsData } from "../../../../presenters/admin/appointment/appointment.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listAppointments(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      search: search || "",
      role: "admin",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
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
    const viewData = prepareAppointmentDetailsData(appointment);

    return res.render("admin/_details", {
      pageTitle: `Termin — ${appointment.korisnik.ime}`,
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

    await appointmentService.reassignAppointment(appointmentId, req.body.employeeId, req.session?.user?.id);
    logInfo(`[reassignAppointment] Termin #${appointmentId} preraspoređen`, { appointmentId, newEmployeeId: req.body.employeeId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Termin je uspešno preraspoređen", `/admin/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[reassignAppointment] Greška pri preraspodeli termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
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
  deleteAppointment,
};