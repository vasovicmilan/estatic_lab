import appointmentService from "../../../../services/appointment.service.js";
import serviceService from "../../../../services/service.service.js";
import * as employeeService from "../../../../services/employee.service.js";
import * as userService from "../../../../services/user.service.js";
import * as packagePurchaseService from "../../../../services/package-purchase.service.js";
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

  // findActiveServices returns the public "card" shape (mapServiceForPublicCard) -
  // just a price RANGE string, no per-variant array at all. The full packages/
  // variants list only exists on a single service's detail shape (getServiceById /
  // getServiceBySlug), so each active service needs its own follow-up fetch here.
  const [servicesWithVariants, employeeOptionsPerService] = await Promise.all([
    Promise.all(servicesResult.data.map((s) => serviceService.getServiceById(s.id))),
    Promise.all(servicesResult.data.map((s) => employeeService.getEmployeeOptionsForService(s.id))),
  ]);

  const employeesByService = Object.fromEntries(servicesResult.data.map((s, i) => [s.id, employeeOptionsPerService[i]]));

  return {
    services: servicesWithVariants.map((s) => ({
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
      packagePurchaseId,
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
        // hasOverride wins if the admin somehow submitted both - a hand-typed
        // price is a more deliberate, explicit choice than a leftover checked
        // box from before the override was toggled on, and bookAppointment
        // would reject the combination outright anyway (see its own
        // priceOverride/packagePurchaseId mutual-exclusion check)
        packagePurchaseId: hasOverride ? null : packagePurchaseId || null,
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
        packagePurchaseId: { old: null, new: hasOverride ? null : packagePurchaseId || null },
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

/**
 * AJAX check backing the manual-creation form's "use existing user's package"
 * option (see admin-manual-appointment.js) - called whenever both an existing
 * user and a service variant are selected, mirroring what the public booking
 * flow already does automatically via findUsablePurchaseForService (see
 * booking.controller.js). Never trusted as authorization on its own: the real
 * check happens again server-side in bookAppointment/assertUsablePurchase at
 * actual creation time - this only decides whether to show the checkbox at all.
 */
export async function checkManualAppointmentPackage(req, res) {
  try {
    const { existingUserId, servicePackageId } = req.body;
    if (!existingUserId || !servicePackageId) {
      return res.status(400).json({ usable: false, message: "Korisnik i varijanta su obavezni" });
    }

    const purchase = await packagePurchaseService.findUsablePurchaseForService(existingUserId, servicePackageId);
    if (!purchase) {
      return res.status(200).json({ usable: false });
    }

    const item = (purchase.items || []).find((i) => String(i.servicePackageId) === String(servicePackageId));
    const preostaloSeansi = item ? item.sessionsTotal - item.sessionsUsed - (item.sessionsReserved || 0) : 0;

    return res.status(200).json({ usable: true, packagePurchaseId: purchase._id.toString(), preostaloSeansi });
  } catch (error) {
    logError("[checkManualAppointmentPackage] Greška pri proveri paketa korisnika", error, {
      body: req.body,
      userId: req.session?.user?.id,
    });
    return res.status(400).json({ usable: false, message: "Greška pri proveri paketa" });
  }
}

export default { newManualAppointmentForm, createManualAppointment, checkManualAppointmentPackage };