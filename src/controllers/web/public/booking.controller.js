import * as serviceService from "../../../services/service.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as availabilityService from "../../../services/availability.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import * as packagePurchaseService from "../../../services/package-purchase.service.js";
import {
  prepareBookingServiceStepData,
  prepareBookingSlotsStepData,
  prepareBookingContactStepData,
  prepareBookingConfirmationData,
} from "../../../presenters/public/booking.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

// Step 1 - GET /zakazivanje/:serviceSlug
export async function serviceStep(req, res, next) {
  try {
    const { serviceSlug } = req.params;
    const service = await serviceService.getServiceBySlug(serviceSlug);
    const viewData = prepareBookingServiceStepData(service);

    return res.render("booking/service-step", {
      pageTitle: `Zakazivanje - ${service.naziv}`,
      pageDescription: "Izaberite varijantu usluge",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[serviceStep] Greška pri učitavanju koraka izbora usluge", error, { serviceSlug: req.params.serviceSlug });
    next(error);
  }
}

// Step 2 - GET /zakazivanje/:serviceSlug/termin?servicePackageId=&date=&employeeId=
export async function slotsStep(req, res, next) {
  try {
    const { serviceSlug } = req.params;
    const { servicePackageId, date, employeeId } = req.query;

    if (!servicePackageId) {
      return flashAndRedirect(req, res, "error", "Izaberite varijantu usluge pre nastavka", `/zakazivanje/${serviceSlug}`);
    }

    const service = await serviceService.getServiceBySlug(serviceSlug);
    const variant = service.varijante.find((p) => p.id === servicePackageId);
    if (!variant) {
      return flashAndRedirect(req, res, "error", "Izabrana varijanta nije pronađena", `/zakazivanje/${serviceSlug}`);
    }

    const targetDate = date ? new Date(date) : new Date();
    const rawEmployees = await employeeService.findEmployeesByServiceRaw(service.id);
    const employees = rawEmployees.map((e) => employeeService.getEmployeeById(e._id, "user", "short"));

    const slots = await availabilityService.getAvailableSlots({
      serviceId: service.id,
      servicePackageId,
      employeeId: employeeId || null,
      date: targetDate,
    });

    const viewData = prepareBookingSlotsStepData(service, variant, {
      date: targetDate.toISOString().slice(0, 10),
      employeeId: employeeId || "",
      employees: await Promise.all(employees),
      slots: slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        employeeId: s.employeeId || s.employeeIds?.[0] || null,
      })),
    });

    return res.render("booking/slots-step", {
      pageTitle: `Zakazivanje - ${service.naziv}`,
      pageDescription: "Izaberite datum i termin",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[slotsStep] Greška pri učitavanju dostupnih termina", error, { serviceSlug: req.params.serviceSlug, query: req.query });
    next(error);
  }
}

// Step 3 - GET /zakazivanje/:serviceSlug/podaci?servicePackageId=&startTime=&employeeId=
export async function contactStep(req, res, next) {
  try {
    const { serviceSlug } = req.params;
    const { servicePackageId, startTime, employeeId } = req.query;

    if (!servicePackageId || !startTime) {
      return flashAndRedirect(req, res, "error", "Izaberite termin pre nastavka", `/zakazivanje/${serviceSlug}`);
    }

    const service = await serviceService.getServiceBySlug(serviceSlug);
    const variant = service.varijante.find((p) => p.id === servicePackageId);
    if (!variant) {
      return flashAndRedirect(req, res, "error", "Izabrana varijanta nije pronađena", `/zakazivanje/${serviceSlug}`);
    }

    const isLoggedIn = !!req.session?.isLoggedIn;
    const usablePackagePurchase = isLoggedIn
      ? await packagePurchaseService.findUsablePurchaseForService(req.session.user.id, servicePackageId)
      : null;

    const viewData = prepareBookingContactStepData(
      service,
      variant,
      { startTime, employeeId: employeeId || null },
      { isLoggedIn, user: req.session?.user, usablePackagePurchase }
    );

    return res.render("booking/contact-step", {
      pageTitle: `Zakazivanje - ${service.naziv}`,
      pageDescription: "Unesite podatke za kontakt",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[contactStep] Greška pri učitavanju koraka unosa podataka", error, { serviceSlug: req.params.serviceSlug, query: req.query });
    next(error);
  }
}

// Step 4 - POST /zakazivanje/potvrda
export async function confirmBooking(req, res, next) {
  const {
    serviceSlug,
    serviceId,
    servicePackageId,
    employeeId,
    startTime,
    firstName,
    lastName,
    email,
    phone,
    note,
    couponCode,
    packagePurchaseId,
  } = req.body;

  try {
    const isLoggedIn = !!req.session?.isLoggedIn;

    if (req.validationErrors) {
      logWarn("[confirmBooking] Validacione greške pri zakazivanju", { validationErrors: req.validationErrors, email });
      const service = await serviceService.getServiceBySlug(serviceSlug);
      const variant = service.varijante.find((p) => p.id === servicePackageId);
      const usablePackagePurchase = isLoggedIn
        ? await packagePurchaseService.findUsablePurchaseForService(req.session.user.id, servicePackageId)
        : null;
      const viewData = prepareBookingContactStepData(
        service,
        variant,
        { startTime, employeeId: employeeId || null },
        { isLoggedIn, user: req.session?.user, errors: req.validationErrors, usablePackagePurchase }
      );
      return res.status(400).render("booking/contact-step", {
        pageTitle: `Zakazivanje - ${service.naziv}`,
        pageDescription: "Unesite podatke za kontakt",
        data: { ...viewData, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const { appointment, accountJustCreated } = await appointmentService.bookAppointment({
      serviceId,
      servicePackageId,
      employeeId: employeeId || null,
      startTime: new Date(startTime),
      isLoggedIn,
      userId: isLoggedIn ? req.session.user.id : null,
      contact: { firstName, lastName, email, phone },
      note,
      couponCode: couponCode || null,
      packagePurchaseId: packagePurchaseId || null,
    });

    logInfo(`[confirmBooking] Termin zakazan za "${email}"`, { appointmentId: appointment.id, accountJustCreated });

    req.session.pendingBookingConfirmation = { appointment, accountJustCreated };
    return res.redirect(`/zakazivanje/potvrda/${appointment.id}`);
  } catch (error) {
    logError("[confirmBooking] Greška pri zakazivanju termina", error, { serviceId, servicePackageId, startTime, email });

    if (error.statusCode === 400) {
      // never lose what the visitor already typed - re-render the same step with their
      // contact details intact and the specific reason the booking failed
      try {
        const isLoggedIn = !!req.session?.isLoggedIn;
        const service = await serviceService.getServiceBySlug(serviceSlug);
        const variant = service.varijante.find((p) => p.id === servicePackageId);
        const usablePackagePurchase = isLoggedIn
          ? await packagePurchaseService.findUsablePurchaseForService(req.session.user.id, servicePackageId)
          : null;
        const viewData = prepareBookingContactStepData(
          service,
          variant,
          { startTime, employeeId: employeeId || null },
          { isLoggedIn, user: req.session?.user, errors: { general: error.message }, usablePackagePurchase }
        );
        return res.status(400).render("booking/contact-step", {
          pageTitle: `Zakazivanje - ${service.naziv}`,
          pageDescription: "Unesite podatke za kontakt",
          data: { ...viewData, formData: req.body, csrfToken: res.locals.csrfToken },
        });
      } catch (renderError) {
        logError("[confirmBooking] Greška pri ponovnom renderovanju forme nakon neuspešnog zakazivanja", renderError);
        return flashAndRedirect(req, res, "error", error.message, `/zakazivanje/${serviceSlug}`);
      }
    }
    next(error);
  }
}

// GET /zakazivanje/potvrda/:appointmentId - one-time confirmation view
export async function confirmation(req, res, next) {
  try {
    const pending = req.session.pendingBookingConfirmation;
    delete req.session.pendingBookingConfirmation;

    if (!pending || pending.appointment.id !== req.params.appointmentId) {
      return res.redirect("/");
    }

    const viewData = prepareBookingConfirmationData(pending.appointment, { accountJustCreated: pending.accountJustCreated });

    return res.render("booking/confirmation", {
      pageTitle: "Termin zakazan",
      pageDescription: "Vaš termin je uspešno zakazan",
      data: viewData,
    });
  } catch (error) {
    logError("[confirmation] Greška pri prikazu potvrde zakazivanja", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

export default { serviceStep, slotsStep, contactStep, confirmBooking, confirmation };