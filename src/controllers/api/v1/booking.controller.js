import * as serviceService from "../../../services/service.service.js";
import * as availabilityService from "../../../services/availability.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import * as packagePurchaseService from "../../../services/package-purchase.service.js";
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

export default { getSlots, confirmBooking };
