import * as serviceService from "../../../services/service.service.js";
import * as availabilityService from "../../../services/availability.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import * as packagePurchaseService from "../../../services/package-purchase.service.js";
import couponService from "../../../services/coupon.service.js";
import { getCapturedReferralCode } from "../../../middlewares/coupon-capture.middleware.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { badRequest } from "../../../utils/error.util.js";

// The web booking flow is a 4-step wizard because a browser needs a page per step
// (service -> slots -> contact form -> confirm), with session state carrying the
// selection between them. An API client already holds all of that client-side and
// can send it in one shot, so this collapses to two calls: browse slots, then
// confirm with everything included - no server-side wizard state needed at all.

// GET /api/v1/booking/:serviceSlug/slots?servicePackageId=&date=&employeeId=
export async function getSlots(req, res, next) {
  try {
    const { serviceSlug } = req.params;
    const { servicePackageId, date, employeeId } = req.query;

    if (!servicePackageId) badRequest("servicePackageId je obavezan");

    const service = await serviceService.getServiceBySlug(serviceSlug);
    const variant = service.varijante.find((p) => p.id === servicePackageId);
    if (!variant) badRequest("Izabrana varijanta nije pronađena");

    const targetDate = date ? new Date(date) : new Date();
    const rawEmployees = await employeeService.findEmployeesByServiceRaw(service.id);
    const employees = await Promise.all(rawEmployees.map((e) => employeeService.getEmployeeById(e._id, "user", "short")));

    const slots = await availabilityService.getAvailableSlots({
      serviceId: service.id,
      servicePackageId,
      employeeId: employeeId || null,
      date: targetDate,
    });

    // Same reasoning as slots-step.ejs's presenter comment: never pick an arbitrary
    // single employee out of employeeIds when several are free for a slot - leaving
    // employeeId null here lets bookAppointment's own resolveEmployeeAssignment
    // decide (auto-assign only when exactly one is actually free).
    const data = {
      service: { id: service.id, naziv: service.naziv, slug: service.slug },
      variant,
      date: targetDate.toISOString().slice(0, 10),
      employees,
      slots: slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, employeeId: s.employeeId || null })),
    };

    // Authenticated callers get an extra, honest answer to "can I pay this from a
    // package I already own" up front - guests never have one, so this is skipped
    // entirely rather than always shipping a field that's always null for them.
    if (req.user) {
      const usablePackagePurchase = await packagePurchaseService.findUsablePurchaseForService(req.user.id, servicePackageId);
      data.usablePackagePurchase = usablePackagePurchase || null;
    }

    return res.json({ success: true, data });
  } catch (error) {
    logError("[api/getSlots] Greška", error, { serviceSlug: req.params.serviceSlug, query: req.query });
    next(error);
  }
}

// POST /api/v1/booking/confirm
export async function confirmBooking(req, res, next) {
  const { serviceId, servicePackageId, employeeId, startTime, firstName, lastName, email, phone, note, couponCode, packagePurchaseId } = req.body;

  try {
    const isLoggedIn = !!req.user;

    const { appointment, accountJustCreated } = await appointmentService.bookAppointment({
      serviceId,
      servicePackageId,
      employeeId: employeeId || null,
      startTime: new Date(startTime),
      isLoggedIn,
      userId: isLoggedIn ? req.user.id : null,
      contact: { firstName, lastName, email, phone },
      note,
      couponCode: couponCode || null,
      packagePurchaseId: packagePurchaseId || null,
    });

    logInfo(`[api/confirmBooking] Termin zakazan za "${email}"`, { appointmentId: appointment.id, accountJustCreated });

    return res.status(201).json({ success: true, data: { appointment, accountJustCreated } });
  } catch (error) {
    logError("[api/confirmBooking] Greška pri zakazivanju termina", error, { serviceId, servicePackageId, startTime, email });
    next(error);
  }
}

// GET /api/v1/booking/referral-code
// Gap fix: the referral/partner code captured from `?code=` in the URL (see
// coupon-capture.middleware.js) is stored in an httpOnly cookie on purpose -
// it can't be read directly by frontend JS. The web flow doesn't need to
// read it client-side either (contactStep auto-applies it server-side into
// req.session.activeCoupon), but the Angular booking widget has no session
// to auto-apply into - it needs an explicit way to ask "is a code already
// captured for this visitor?" so it can pre-fill (not silently apply) the
// coupon field, exactly like the web contact-step does automatically.
export function getCapturedReferral(req, res) {
  return res.json({ success: true, data: { code: getCapturedReferralCode(req) } });
}

// POST /api/v1/booking/coupon/check
// Gap fix: there was no public way to preview a coupon's discount before
// confirming a booking - confirmBooking already validates+redeems couponCode
// internally (see appointmentService.bookAppointment), but only at the very
// end, after every other field was already filled in. This is a read-only
// preview (mirrors admin-package-purchase.controller.js's
// checkPackagePurchaseCoupon), open to guests same as the rest of booking -
// serviceId/servicePackageId are looked up server-side rather than trusting
// a client-sent price, so the discount preview can't be spoofed by sending a
// fake appointmentValue.
export async function checkCoupon(req, res) {
  try {
    const { code, serviceId, servicePackageId } = req.body;
    if (!code || !serviceId || !servicePackageId) {
      return res.status(400).json({ success: false, error: { message: "Kod kupona, usluga i varijanta su obavezni" } });
    }

    const { variant } = await serviceService.getActiveVariant(serviceId, servicePackageId);
    if (!variant) return res.status(404).json({ success: false, error: { message: "Izabrana varijanta nije pronađena" } });

    const { discountAmount } = await couponService.validateCouponForBooking(code, {
      userId: req.user?.id || null,
      serviceId,
      appointmentValue: variant.totalPrice,
    });

    return res.json({
      success: true,
      data: { originalPrice: variant.totalPrice, discountAmount, finalPrice: Math.max(0, variant.totalPrice - discountAmount) },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, error: { message: error.message || "Kupon nije važeći" } });
  }
}

export default { getSlots, confirmBooking, getCapturedReferral, checkCoupon };
