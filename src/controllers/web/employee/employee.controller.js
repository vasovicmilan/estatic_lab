import * as employeeService from "../../../services/employee.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import {
  prepareEmployeeDashboardData,
  prepareEmployeeAppointmentTabData,
  prepareEmployeeAppointmentDetailData,
  prepareEmployeeProfileTabData,
} from "../../../presenters/employee/employee.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

async function getOwnEmployeeId(req) {
  const employee = await employeeService.findEmployeeByUserId(req.session.user.id);
  return employee?._id?.toString() || employee?.id;
}

export async function dashboard(req, res, next) {
  try {
    const employeeId = await getOwnEmployeeId(req);

    const [today, week] = await Promise.all([
      appointmentService.findAppointments({
        requesterId: employeeId,
        role: "employee",
        filters: { dateFrom: new Date(new Date().setHours(0, 0, 0, 0)), dateTo: new Date(new Date().setHours(23, 59, 59, 999)) },
        limit: 50,
      }),
      appointmentService.findAppointments({ requesterId: employeeId, role: "employee", limit: 50 }),
    ]);

    const pendingCount = week.data.filter((a) => a.status === "Na čekanju").length;
    const viewData = prepareEmployeeDashboardData({ todayAppointments: today.data, pendingCount, weekAppointments: week.data });

    return res.render("employee/dashboard", {
      pageTitle: "Moj kalendar",
      pageDescription: "Pregled vaših termina",
      data: viewData,
    });
  } catch (error) {
    logError("[dashboard] Greška pri učitavanju dashboard-a zaposlenog", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function appointments(req, res, next) {
  try {
    const employeeId = await getOwnEmployeeId(req);
    const { status, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      requesterId: employeeId,
      role: "employee",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareEmployeeAppointmentTabData(result, req.query);

    return res.render("employee/appointments", {
      pageTitle: "Moji termini",
      pageDescription: "Pregled svih vaših termina",
      data: viewData,
    });
  } catch (error) {
    logError("[appointments] Greška pri učitavanju termina zaposlenog", error, { userId: req.session?.user?.id, ...req.query });
    next(error);
  }
}

export async function appointmentDetails(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.getAppointmentById(appointmentId, req.session.user.id, "employee");
    const viewData = prepareEmployeeAppointmentDetailData(appointment);

    return res.render("employee/appointment-details", {
      pageTitle: `Termin — ${appointment.klijent.ime}`,
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
    await appointmentService.confirmAppointment(appointmentId, req.session.user.id, "employee");
    logInfo(`[confirmAppointment] Zaposleni potvrdio termin #${appointmentId}`, { appointmentId, userId: req.session.user.id });
    return flashAndRedirect(req, res, "success", "Termin je potvrđen", `/moji-termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[confirmAppointment] Greška pri potvrđivanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/moji-termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function rejectAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[rejectAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/moji-termini/detalji/${appointmentId}`);
    }

    await appointmentService.rejectAppointment(appointmentId, req.body.reason, req.session.user.id, "employee");
    logInfo(`[rejectAppointment] Zaposleni odbio termin #${appointmentId}`, { appointmentId, userId: req.session.user.id });
    return flashAndRedirect(req, res, "success", "Termin je odbijen", `/moji-termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[rejectAppointment] Greška pri odbijanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/moji-termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function completeAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.completeAppointment(appointmentId, req.session.user.id, "employee");
    logInfo(`[completeAppointment] Zaposleni završio termin #${appointmentId}`, { appointmentId, userId: req.session.user.id });
    return flashAndRedirect(req, res, "success", "Termin je označen kao završen", `/moji-termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[completeAppointment] Greška pri završavanju termina", error, { appointmentId: req.params.appointmentId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/moji-termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function profile(req, res, next) {
  try {
    const employee = await employeeService.findEmployeeProfile(req.session.user.id, "employee");
    const viewData = prepareEmployeeProfileTabData(employee);

    return res.render("employee/profile", {
      pageTitle: "Moj profil",
      pageDescription: "Pregled vašeg profila i radnog vremena",
      data: { ...viewData, csrfToken: req.csrfToken?.() },
    });
  } catch (error) {
    logError("[profile] Greška pri učitavanju profila zaposlenog", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateWorkingHours(req, res, next) {
  try {
    const employeeId = await getOwnEmployeeId(req);
    await employeeService.manageWorkingHours(employeeId, req.body.workingHours || [], req.session.user.id, "employee");
    logInfo(`[updateWorkingHours] Zaposleni #${req.session.user.id} ažurirao radno vreme`, { userId: req.session.user.id });
    return flashAndRedirect(req, res, "success", "Radno vreme je uspešno ažurirano", "/moj-profil");
  } catch (error) {
    logError("[updateWorkingHours] Greška pri ažuriranju radnog vremena", error, { userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/moj-profil");
    }
    next(error);
  }
}

export default {
  dashboard,
  appointments,
  appointmentDetails,
  confirmAppointment,
  rejectAppointment,
  completeAppointment,
  profile,
  updateWorkingHours,
};