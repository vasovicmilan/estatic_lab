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
import { generateSeo } from "../../../seo/index.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";
import { getCapturedReferralCode } from "../../../middlewares/coupon-capture.middleware.js";
import { tryApplyCoupon } from "./coupon.controller.js";

// Every step of the booking flow is public (no auth wall - see booking.routes.js),
// but each page is a personalized, single-use step of a multi-step form with no
// lasting canonical identity of its own (same service can be reached mid-flow via
// many different query strings/dates/times) - so all of them are deliberately
// noindex, same convention as blog.service.js's search results page. Kept as a
// small local helper (not global middleware/res.locals) since only this file needs it.
async function bookingSeo(req, { title, description }) {
  return generateSeo("page", { title, description, slug: req.originalUrl, noIndex: true }, req);
}

// Step 1 - GET /zakazivanje/:serviceSlug
export async function serviceStep(req, res, next) {
  try {
    const { serviceSlug } = req.params;
    const service = await serviceService.getServiceBySlug(serviceSlug);
    const viewData = prepareBookingServiceStepData(service);

    const seo = await bookingSeo(req, { title: `Zakazivanje - ${service.naziv}`, description: "Izaberite varijantu usluge" });
    return res.render("booking/service-step", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
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
        // Only ever a real value when the visitor explicitly filtered to one
        // employee's calendar (s.employeeId is only set in that single-employee
        // branch of getAvailableSlots - see availability.service.js). In merged
        // "any employee" view, a slot can have several employeeIds free for it
        // (s.employeeIds), and picking employeeIds[0] here used to silently bake
        // an ARBITRARY specific employee into the booking URL - meaning by the
        // time the request reached bookAppointment, employeeId was never
        // actually null, so its whole resolveEmployeeAssignment logic (auto-
        // assign when exactly one is free, leave unassigned for an admin to
        // pick when several are) never got a chance to run. Leaving this null
        // here lets the server make that decision correctly instead.
        employeeId: s.employeeId || null,
      })),
    });

    const seo = await bookingSeo(req, { title: `Zakazivanje - ${service.naziv}`, description: "Izaberite datum i termin" });
    return res.render("booking/slots-step", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
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

    if (req.session.activeCoupon?.context !== "booking") {
      const referralCode = getCapturedReferralCode(req);
      if (referralCode) {
        await tryApplyCoupon(req, { code: referralCode, context: "booking", serviceId: service.id, appointmentValue: viewData.appointmentValue });
      }
    }

    const seo = await bookingSeo(req, { title: `Zakazivanje - ${service.naziv}`, description: "Unesite podatke za kontakt" });
    return res.render("booking/contact-step", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "booking" ? req.session.activeCoupon : null, csrfToken: res.locals.csrfToken },
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
        seo: await bookingSeo(req, { title: `Zakazivanje - ${service.naziv}`, description: "Unesite podatke za kontakt" }),
        data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "booking" ? req.session.activeCoupon : null, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    // the active coupon (see coupon.controller.js) is the source of truth here, not
    // the raw form field - it's only ever set once validateCouponForBooking has
    // already confirmed the code works, so this is exactly what the user previewed
    const activeCoupon = req.session?.activeCoupon?.context === "booking" ? req.session.activeCoupon : null;

    const { appointment, accountJustCreated } = await appointmentService.bookAppointment({
      serviceId,
      servicePackageId,
      employeeId: employeeId || null,
      startTime: new Date(startTime),
      isLoggedIn,
      userId: isLoggedIn ? req.session.user.id : null,
      contact: { firstName, lastName, email, phone },
      note,
      couponCode: activeCoupon?.code || null,
      packagePurchaseId: packagePurchaseId || null,
    });

    delete req.session.activeCoupon;

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
          seo: await bookingSeo(req, { title: `Zakazivanje - ${service.naziv}`, description: "Unesite podatke za kontakt" }),
          data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "booking" ? req.session.activeCoupon : null, formData: req.body, csrfToken: res.locals.csrfToken },
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

    const seo = await bookingSeo(req, { title: "Termin zakazan", description: "Vaš termin je uspešno zakazan" });
    return res.render("booking/confirmation", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[confirmation] Greška pri prikazu potvrde zakazivanja", error, { appointmentId: req.params.appointmentId });
    next(error);
  }
}

export default { serviceStep, slotsStep, contactStep, confirmBooking, confirmation };