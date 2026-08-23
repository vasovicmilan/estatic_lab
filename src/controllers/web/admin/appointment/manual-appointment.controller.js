import appointmentService from "../../../../services/appointment.service.js";
import serviceService from "../../../../services/service.service.js";
import * as employeeService from "../../../../services/employee.service.js";
import * as userService from "../../../../services/user.service.js";
import { prepareManualAppointmentFormData } from "../../../../presenters/admin/appointment/manual-appointment.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

/**
 * Loads everything the manual-creation form needs to build its client-side
 * cascading service -> variant -> eligible-employee pickers, plus the
 * existing-user dropdown - all up front in one page load rather than several
 * AJAX round-trips, since the admin/employee catalog here is small enough
 * (unlike the public booking flow's slot-availability lookups, which
 * genuinely need to be live/per-request).
 */
async function loadFormOptions() {
  const [servicesResult, usersResult] = await Promise.all([
    serviceService.findActiveServices({ limit: 200 }),
    userService.listUsers({ status: "active", limit: 200 }),
  ]);

  // one lookup per service (same getEmployeeOptionsForService the public
  // booking flow's slotsStep already uses), not one over the whole employee
  // list - the admin list shape (mapEmployeeForAdminShort) doesn't carry each
  // employee's service ids, only a count, so this is the option that's
  // actually available without a new mapper field
  const employeeEntries = await Promise.all(
    servicesResult.data.map(async (s) => [s.id, await employeeService.getEmployeeOptionsForService(s.id)])
  );
  const employeesByService = Object.fromEntries(employeeEntries);

  return {
    services: servicesResult.data.map((s) => ({
      id: s.id,
      name: s.naziv,
      variants: (s.varijante || [])
        .filter((v) => v.aktivan)
        .map((v) => ({ id: v.id, name: v.naziv, duration: v.trajanje, price: v.cena })),
    })),
    employeesByService,
    userOptions: usersResult.data.map((u) => ({ value: u.id, label: `${u.imePrezime} (${u.email})` })),
  };
}

export async function newManualAppointmentForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = prepareManualAppointmentFormData(options);
    return res.render("admin/appointment/manual-create", {
      pageTitle: "Novi termin (ručno)",
      pageDescription: "Ručno kreiranje termina - walk-in, poklon, nagrada i slično",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newManualAppointmentForm] Greška pri prikazu forme za ručno kreiranje termina", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function createManualAppointment(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createManualAppointment] Validacione greške pri ručnom kreiranju termina", {
        validationErrors: req.validationErrors,
        userId: req.session?.user?.id,
      });
      const options = await loadFormOptions();
      const formData = prepareManualAppointmentFormData(options);
      return res.status(400).render("admin/appointment/manual-create", {
        pageTitle: "Novi termin (ručno)",
        pageDescription: "Ručno kreiranje termina - walk-in, poklon, nagrada i slično",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const {
      serviceId,
      servicePackageId,
      employeeId,
      startTime,
      existingUserId,
      firstName,
      lastName,
      email,
      phone,
      note,
      overridePrice,
      priceOverride,
    } = req.body;

    const hasOverride = parseCheckbox(overridePrice, false);
    const parsedOverride = hasOverride && priceOverride !== "" ? parseFloat(priceOverride) : null;

    const { appointment } = await appointmentService.createManualAppointment(
      {
        serviceId,
        servicePackageId,
        employeeId: employeeId || null,
        startTime: new Date(startTime),
        existingUserId: existingUserId || null,
        contact: { firstName, lastName, email, phone },
        note: note || "",
        priceOverride: parsedOverride,
      },
      { actorId: req.session?.user?.id, actorRole: req.session?.user?.roleName === "admin" ? "admin" : "employee" }
    );

    logInfo(`[createManualAppointment] Termin ručno kreiran za "${email}"`, {
      appointmentId: appointment.id,
      adminId: req.session?.user?.id,
      hasOverride,
    });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_MANUALLY_CREATED",
      entity: { type: "Appointment", id: appointment.id },
      changes: {
        serviceId: { old: null, new: serviceId },
        priceOverride: { old: null, new: parsedOverride },
      },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Termin je uspešno ručno kreiran", `/admin/termini/detalji/${appointment.id}`);
  } catch (error) {
    logError("[createManualAppointment] Greška pri ručnom kreiranju termina", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 403) {
      const options = await loadFormOptions();
      const formData = prepareManualAppointmentFormData(options);
      return res.status(error.statusCode).render("admin/appointment/manual-create", {
        pageTitle: "Novi termin (ručno)",
        pageDescription: "Ručno kreiranje termina - walk-in, poklon, nagrada i slično",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export default { newManualAppointmentForm, createManualAppointment };