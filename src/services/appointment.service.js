import mongoose from "mongoose";
import eventEmitter from "../events/event.emitter.js";
import appointmentRepo from "../repositories/appointment.repository.js";
import userService from "./user.service.js";
import serviceService from "./service.service.js";
import couponService from "./coupon.service.js";
import availabilityService from "./availability.service.js";
import employeeService from "./employee.service.js";
import resourceService from "./resource.service.js";
import packagePurchaseService from "./package-purchase.service.js";
import { mapAppointment, mapAppointmentsForAdminList } from "../mappers/appointment.mapper.js";
import { getAllowedStatuses } from "../models/appointment-status-transitions.js";
import { canUserCancelAppointment, getRescheduleWindow, hasMinimumRescheduleLeadTime, isSameCalendarDay } from "../utils/appointment-cancellation.util.js";
import { buildPhoneRecord } from "../utils/phone.util.js";
import { isEmployeeWorkingAt } from "../utils/working-hours.util.js";
import { USER_CANCELLATION_CUTOFF_HOURS, RESCHEDULE_CUTOFF_HOURS, RESCHEDULE_SAME_DAY_FLOOR_HOURS, RESCHEDULE_MIN_LEAD_MINUTES } from "../config/booking.config.js";
import { validationError, notFound, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";

const defaultPopulate = [
  { path: "user", select: "firstName lastName email phone" },
  { path: "service", select: "name slug" },
  { path: "employee", populate: { path: "userId", select: "firstName lastName" } },
  { path: "assignedTo", populate: { path: "userId", select: "firstName lastName" } },
  { path: "coupon", select: "code" },
];

function canAccessAppointment(appointment, requesterId, requesterRole) {
  if (requesterRole === "admin") return true;
  if (requesterRole === "employee") {
    const empId = appointment.employee?._id?.toString() || appointment.employee?.toString();
    const assignedId = appointment.assignedTo?._id?.toString() || appointment.assignedTo?.toString();
    return empId === String(requesterId) || assignedId === String(requesterId);
  }
  const userId = appointment.user?._id?.toString() || appointment.user?.toString();
  return userId === String(requesterId);
}

async function getPopulatedAppointment(id, { session } = {}) {
  return appointmentRepo.findAppointmentById(id, { populateFields: defaultPopulate, session });
}

// Each entry in service.resources can arrive as a raw ObjectId or a populated
// doc depending on how the service was queried - see the same normalization in
// availability.service.js and service.mapper.js. Returns the full list, since
// a service can require more than one resource pool at once (e.g. an ESMA
// device AND a table).
function resolveResourceIds(service) {
  if (!service?.resources || !Array.isArray(service.resources)) return [];
  return service.resources.map((r) => (typeof r === "object" ? r._id?.toString() : r?.toString())).filter(Boolean);
}

/**
 * Decides who (if anyone) gets an appointment when the customer didn't pick a
 * specific employee. Throws if nobody is deliverable at all.
 *
 * - Exactly one employee actually free at this time -> auto-assign them. There's
 *   no real decision being deferred here: whether that's because only one
 *   employee can perform the service at all, or several can but only one is on
 *   shift / not already booked elsewhere right now, the outcome is the same -
 *   there's only one possible answer, so there's nothing for an admin to
 *   decide. Leaving `employee` null in this case would just create a
 *   scheduling blind spot: findBusyIntervals/findOverlappingAppointments only
 *   match a non-null `employee` (or `assignedTo`), so an unassigned
 *   appointment doesn't count against anyone's calendar until an admin
 *   manually assigns it - which let this same person get double-booked into a
 *   different service in the meantime.
 * - Two or more employees genuinely free at this time -> leave it unassigned.
 *   THIS is the case with a real business decision behind it (which of them
 *   should take it), so it's left for an admin to pick from the appointment
 *   details page (see reassignAppointment).
 */
async function resolveEmployeeAssignment(serviceId, start, end, resolvedResources, { session } = {}) {
  const freeEmployees = await availabilityService.findAvailableEmployees(serviceId, start, end, { session, resources: resolvedResources });
  if (!freeEmployees.length) badRequest("Nijedan terapeut nije dostupan za izabrani termin, izaberite drugi");
  return freeEmployees.length === 1 ? freeEmployees[0]._id : null;
}

export async function findAppointments({ search = "", limit = 20, page = 1, requesterId = null, role = "user", filters = {} } = {}) {
  const scopedFilters = { ...filters };
  if (role === "user") scopedFilters.userId = requesterId;
  if (role === "employee") scopedFilters.employeeId = requesterId;

  const result = await appointmentRepo.findAppointments({ search, limit, page, filters: scopedFilters, populateFields: defaultPopulate });

  return {
    data: role === "admin" ? mapAppointmentsForAdminList(result.data) : result.data.map((a) => mapAppointment(a, role, "short")),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getAppointmentById(appointmentId, requesterId, role) {
  if (!appointmentId) validationError("appointmentId");
  const appointment = await getPopulatedAppointment(appointmentId);
  if (!appointment) notFound("Termin");
  if (!canAccessAppointment(appointment, requesterId, role)) forbidden("Nemate pristup ovom terminu");
  return mapAppointment(appointment, role, "detail");
}

/**
 * Raw (unmapped) appointment data for commission.service.js's internal use only -
 * needs finalPrice and the employee's pay type/commission rate plus the coupon's
 * partner, none of which any mapped shape exposes in the right form. Kept
 * narrowly scoped and separate from getAppointmentById on purpose: this is not
 * a general-purpose getter, just the one thing commission calculation needs.
 */
export async function getAppointmentForCommission(appointmentId) {
  return appointmentRepo.findAppointmentById(appointmentId, {
    populateFields: ["employee", "packagePurchase", { path: "coupon", populate: "partner" }],
  });
}

/**
 * Raw busy intervals for one employee on one day - for availability.service.js's
 * internal use only, computing free slots from working hours minus these.
 */
export async function getBusyIntervals(employeeId, dayStart, dayEnd) {
  return appointmentRepo.findBusyIntervals(employeeId, dayStart, dayEnd);
}

/**
 * Raw busy intervals for a shared RESOURCE (table/device/room) on one day,
 * across every employee - for availability.service.js's internal use only.
 * Mirrors getBusyIntervals exactly, just keyed by resource instead of employee.
 * Called once per required resource when a service needs more than one.
 */
export async function getResourceBusyIntervals(resourceId, dayStart, dayEnd) {
  return appointmentRepo.findResourceBusyIntervals(resourceId, dayStart, dayEnd);
}

/**
 * Whether an employee has any appointment overlapping the given window - for
 * availability.service.js's write-time final-check before actually booking,
 * since the slot list the visitor saw may be a few seconds stale by then. Also
 * used to build the admin reassignment dropdown (excludeId lets an appointment
 * being reassigned skip its own conflict against itself, so the employee it's
 * currently assigned to still shows up as an eligible option).
 */
export async function hasOverlappingAppointment(employeeId, startTime, endTime, { session, excludeId = null } = {}) {
  const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, startTime, endTime, excludeId, { session });
  return overlapping.length > 0;
}

/**
 * How many active appointments are already occupying a resource in a window
 * overlapping [startTime, endTime] - for availability.service.js and this
 * file's own bookAppointment to compare against that resource's capacity.
 * Called once per required resource when a service needs more than one.
 */
export async function countOverlappingResourceAppointments(resourceId, startTime, endTime, { session } = {}) {
  return appointmentRepo.countOverlappingResourceAppointments(resourceId, startTime, endTime, null, { session });
}

/**
 * The core booking flow. Reads that only inform a decision happen before the
 * transaction; the guest-user creation (if any), the Appointment write, and (when
 * paying via a package) the session reservation all happen inside one transaction;
 * events fire only after commit.
 *
 * `packagePurchaseId` is only honored when `isLoggedIn` - a package purchase belongs
 * to a real account, never a guest - and is mutually exclusive with `couponCode`: a
 * booking is either paid in full (minus an optional coupon) or fully covered by a
 * package, never both. Paying via a package RESERVES one session at booking time
 * (not "consumes" - see package-purchase.service.js). The reservation is released if
 * the appointment is later cancelled/rejected, and only actually committed (moved
 * into sessionsUsed) once the appointment is marked completed - see transitionStatus.
 *
 * If the service requires shared resources (Service.resources - one or more
 * tables/devices/rooms multiple employees compete for, see Resource model),
 * booking also has to clear a resource-capacity check on top of the
 * employee-availability check for EVERY required resource: an employee being
 * free is not enough by itself if any one of the things this specific service
 * needs is already fully booked by someone else's appointment.
 */
export async function bookAppointment(input) {
  const {
    serviceId,
    servicePackageId,
    employeeId = null,
    startTime,
    isLoggedIn = false,
    userId = null,
    contact = {},
    note = "",
    couponCode = null,
    packagePurchaseId = null,
    // ---- manual/admin booking only (see createManualAppointment in this file) ----
    // Lets an admin (or employee, if ever given the permission) set the actual
    // charged price by hand instead of the service's catalog price - for
    // giveaways, prizes, and similar cases where the real price genuinely isn't
    // the service's normal price, but running it through a coupon would be
    // either mathematically wrong (coupons discount a percentage/fixed amount
    // OFF the catalog price, they don't replace it outright) or a security
    // concern (a coupon is a code any authenticated caller could theoretically
    // try to replay - a price override is not, it never leaves the admin panel
    // and is validated against actorRole below, not against a redeemable code).
    priceOverride = null,
    actorRole = null,
  } = input;

  if (!serviceId) validationError("serviceId");
  if (!servicePackageId) validationError("servicePackageId");
  if (!startTime) validationError("startTime");
  if (!contact.email) validationError("email");
  if (!contact.firstName) validationError("firstName");
  if (packagePurchaseId && !isLoggedIn) badRequest("Plaćanje paketom je dostupno samo prijavljenim korisnicima");

  if (priceOverride != null) {
    if (actorRole !== "admin" && actorRole !== "employee") {
      forbidden("Samo administrator ili zaposleni mogu ručno podesiti cenu termina");
    }
    if (typeof priceOverride !== "number" || isNaN(priceOverride) || priceOverride < 0) {
      badRequest("Neispravna ručno uneta cena");
    }
    if (couponCode || packagePurchaseId) {
      badRequest("Ručno podešena cena ne može se kombinovati sa kuponom ili plaćanjem paketom");
    }
  }

  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (isNaN(start.getTime())) badRequest("Neispravno vreme termina");
  // A manual admin/employee booking is explicitly allowed to backdate (e.g.
  // logging a walk-in giveaway redemption that already happened) - the
  // in-the-past guard below only makes sense for the public self-service flow.
  if (priceOverride == null && start < new Date()) badRequest("Ne možete zakazati termin u prošlosti");

  // ---- reads before the transaction ----
  const { variant, service } = await serviceService.getActiveVariant(serviceId, servicePackageId);
  const end = new Date(start.getTime() + variant.duration * 60000);
  // The price actually charged for this appointment - the service's catalog
  // price unless an admin/employee explicitly overrode it above.
  const effectivePrice = priceOverride != null ? priceOverride : variant.totalPrice;

  const resourceIds = resolveResourceIds(service);
  let resolvedResources = []; // [{ resourceId, name, capacity }]
  if (resourceIds.length) {
    const rawResources = await Promise.all(resourceIds.map((id) => resourceService.getResourceByIdRaw(id)));
    resolvedResources = resourceIds.map((resourceId, i) => ({
      resourceId,
      name: rawResources[i]?.name || null,
      capacity: resourceService.getEffectiveCapacity(rawResources[i]),
    }));
    const unavailable = resolvedResources.find((r) => !r.capacity || r.capacity < 1);
    if (unavailable) {
      badRequest("Ova usluga trenutno nije dostupna za zakazivanje (resurs nije aktivan)");
    }
  }

  let buyerId = null;
  let needsGuestUser = false;

  if (isLoggedIn && userId) {
    const existing = await userService.findUserById(userId);
    if (!existing) notFound("Korisnik");
    buyerId = existing._id;
  } else {
    const existing = await userService.findUserByEmail(contact.email);
    if (existing) {
      buyerId = existing._id;
    } else {
      needsGuestUser = true;
    }
  }

  let chosenEmployeeId = null;
  // true only when the SYSTEM resolved the employee (see resolveEmployeeAssignment) -
  // false for an explicit customer choice. Drives whether assignedTo/assignedBy/
  // assignedAt get written below: a customer's direct pick isn't an "assignment"
  // being recorded, it's just what they asked for, so those stay null for that case
  // (see mapAppointment's "Direktno zakazan" vs "Dodeljen od strane sistema" logic,
  // which depends on this distinction).
  let systemAssigned = false;

  if (employeeId) {
    const employeeDoc = await employeeService.getEmployeeByIdRaw(employeeId);
    if (!employeeDoc) notFound("Zaposleni");
    if (!isEmployeeWorkingAt(employeeDoc, start, end)) {
      badRequest("Izabrani terapeut ne radi u ovom terminu, izaberite drugi termin ili terapeuta");
    }

    const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, start, end);
    if (overlapping.length > 0) badRequest("Izabrani termin više nije dostupan, izaberite drugi");

    for (const { resourceId, capacity } of resolvedResources) {
      const resourceCount = await appointmentRepo.countOverlappingResourceAppointments(resourceId, start, end);
      if (resourceCount >= capacity) badRequest("Izabrani termin više nije dostupan (resurs je zauzet), izaberite drugi");
    }

    chosenEmployeeId = employeeId;
  } else {
    // no employee explicitly chosen by the customer - resolve who (if anyone)
    // should get this appointment based on who's ACTUALLY free at this exact
    // time, not just who's generally capable of the service. See
    // resolveEmployeeAssignment below for the decision rule.
    chosenEmployeeId = await resolveEmployeeAssignment(serviceId, start, end, resolvedResources);
    if (chosenEmployeeId) systemAssigned = true;
  }

  let couponResult = null;
  let resolvedPackagePurchase = null;

  if (packagePurchaseId) {
    resolvedPackagePurchase = await packagePurchaseService.assertUsablePurchase(packagePurchaseId, buyerId, servicePackageId);
  } else if (couponCode) {
    couponResult = await couponService.validateCouponForBooking(couponCode, {
      userId: buyerId,
      serviceId,
      appointmentValue: effectivePrice,
    });
  }

  // ---- transaction ----
  const session = await mongoose.startSession();
  let created;
  let accountJustCreated = false;

  try {
    await session.withTransaction(async () => {
      if (needsGuestUser) {
        const guestUser = await userService.createGuestUser(
          { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone },
          { session }
        );
        buyerId = guestUser._id;
        accountJustCreated = true;
      }

      // race guard - re-check right before the write in case two people booked the
      // same slot within seconds of each other off the same availability list
      if (chosenEmployeeId) {
        const stillFree = await appointmentRepo.findOverlappingAppointments(chosenEmployeeId, start, end, null, { session });
        if (stillFree.length > 0) badRequest("Izabrani termin je upravo zauzet, pokušajte ponovo");

        for (const { resourceId, capacity } of resolvedResources) {
          const stillResourceCount = await appointmentRepo.countOverlappingResourceAppointments(resourceId, start, end, null, { session });
          if (stillResourceCount >= capacity) badRequest("Izabrani termin je upravo zauzet (resurs), pokušajte ponovo");
        }
      } else if (!employeeId) {
        // was left unassigned pre-transaction because 2+ employees were free - re-run
        // the same decision now. If the race window happened to leave exactly one of
        // them free (someone else just took the other), this correctly collapses to
        // an auto-assign instead of silently staying unassigned with a stale reason.
        chosenEmployeeId = await resolveEmployeeAssignment(serviceId, start, end, resolvedResources, { session });
        if (chosenEmployeeId) systemAssigned = true;
      }

      const discountApplied = couponResult?.discountAmount || 0;
      const employeeName = chosenEmployeeId ? await employeeService.getEmployeeNameById(chosenEmployeeId) : null;

      created = await appointmentRepo.createAppointment(
        {
          user: buyerId,
          service: serviceId,
          variant: {
            servicePackageId,
            name: variant.name,
            duration: variant.duration,
            price: effectivePrice,
          },
          employee: chosenEmployeeId,
          employeeSnapshot: { name: employeeName },
          resources: resolvedResources.map((r) => ({ resource: r.resourceId, name: r.name })),
          // Written whenever the SYSTEM resolved who gets this appointment (see
          // resolveEmployeeAssignment/systemAssigned above) - this is what actually
          // makes an auto-assignment visible/auditable in the admin UI and mapper
          // (dodeljenTerapeut/dodelio/dodeljenU), mirroring exactly what
          // reassignAppointment already writes for an admin-driven assignment.
          // Left null for both an explicit customer choice (nothing was "decided",
          // they just picked) and a genuinely-unassigned appointment (2+ employees
          // were free - an admin still needs to pick, same as before).
          assignedTo: systemAssigned ? chosenEmployeeId : null,
          assignedBy: systemAssigned ? "system" : null,
          assignedAt: systemAssigned ? new Date() : null,
          startTime: start,
          endTime: end,
          status: "pending",
          note,
          coupon: couponResult?.coupon._id || null,
          packagePurchase: resolvedPackagePurchase?._id || null,
          discountApplied,
          finalPrice: resolvedPackagePurchase ? 0 : Math.max(0, effectivePrice - discountApplied),
          manualBooking: priceOverride != null,
          contactSnapshot: {
            firstName: contact.firstName,
            lastName: contact.lastName || "",
            email: contact.email,
            // encrypted + hashed, not plaintext - see phone.util.js/appointment.model.js.
            // buildPhoneRecord returns null for an empty/missing number, matching the
            // PhoneSchema field's expectation (not the "" this used to store).
            phone: buildPhoneRecord(contact.phone),
          },
        },
        { session }
      );

      if (resolvedPackagePurchase) {
        // reserve, not consume - actual consumption happens on completion
        // (transitionStatus below), and this reservation gets released if the
        // appointment is cancelled/rejected first
        await packagePurchaseService.reserveSession(resolvedPackagePurchase._id, servicePackageId, { session });
      } else if (couponResult) {
        await couponService.redeemCoupon(
          couponResult.coupon._id,
          { userId: buyerId, appointmentId: created._id, discountAmount: discountApplied },
          { session }
        );
      }
    });
  } catch (error) {
    // E11000 here means the new unique (employee, startTime) index caught a real
    // double-booking race that slipped past the in-transaction pre-check above -
    // see appointment.model.js's index comment for why that check alone isn't
    // enough. Surface it as the same friendly, already-localized message rather
    // than a raw Mongo duplicate-key error.
    if (error.code === 11000) {
      logInfo("Booking race caught by the unique index - two requests targeted the same employee+slot", { serviceId, startTime: start });
      badRequest("Izabrani termin je upravo zauzet, pokušajte ponovo");
    }
    logError("Appointment booking transaction failed", error, { serviceId, servicePackageId, startTime: start });
    throw error;
  } finally {
    await session.endSession();
  }

  logInfo("Appointment booked", { appointmentId: created._id, serviceId, userId: String(buyerId), accountJustCreated, resourceIds });

  eventEmitter.emit("appointment:created", {
    appointmentId: created._id,
    userId: buyerId,
    email: contact.email,
    firstName: contact.firstName,
  });

  if (accountJustCreated) {
    const guestUser = await userService.findUserById(buyerId);
    eventEmitter.emit("user:guest_created", {
      userId: buyerId,
      email: guestUser.email,
      firstName: guestUser.firstName,
      resetToken: guestUser.resetToken,
    });
  }

  const populated = await getPopulatedAppointment(created._id);
  return { appointment: mapAppointment(populated, "user", "detail"), accountJustCreated };
}

/**
 * Admin/employee-only entry point for manually creating an appointment - walk-ins,
 * giveaways, prizes, and similar cases where staff are booking on someone's behalf
 * rather than the customer booking themselves. Thin wrapper around bookAppointment:
 * reuses its entire transaction, availability/resource-capacity checking, and
 * employee-assignment logic untouched, and only adds resolving `existingUserId`
 * (an admin picking a registered customer from search) into the isLoggedIn/userId/
 * contact shape bookAppointment already expects. A booking with no existingUserId
 * still works exactly like a guest/walk-in booking - same account-creation path a
 * customer's own guest checkout uses.
 *
 * `priceOverride` and `actorRole` are forwarded as-is - see bookAppointment for the
 * actual permission check and the coupon/package mutual-exclusion rule. `actorRole`
 * is required here (not optional) since this function's entire reason to exist is
 * the manual price override use case; a caller with no real actor role has no
 * business calling this instead of the public bookAppointment directly.
 */
export async function createManualAppointment(input, { actorId = null, actorRole } = {}) {
  if (actorRole !== "admin" && actorRole !== "employee") {
    forbidden("Samo administrator ili zaposleni mogu ručno kreirati termin");
  }

  const { existingUserId = null, contact = {}, ...rest } = input;

  let isLoggedIn = false;
  let userId = null;
  let resolvedContact = contact;

  if (existingUserId) {
    const user = await userService.findUserById(existingUserId);
    if (!user) notFound("Korisnik");
    isLoggedIn = true;
    userId = existingUserId;
    // an admin picking an existing user from search doesn't have to re-type their
    // contact info - fall back to what's already on file, but still let an
    // explicitly-typed override win (e.g. correcting a stale phone number)
    resolvedContact = {
      firstName: contact.firstName || user.firstName,
      lastName: contact.lastName || user.lastName,
      email: contact.email || user.email,
      phone: contact.phone || user.phone,
    };
  }

  logInfo("Manual appointment booking initiated", { actorId, actorRole, existingUserId, hasPriceOverride: rest.priceOverride != null });

  return bookAppointment({
    ...rest,
    isLoggedIn,
    userId,
    contact: resolvedContact,
    actorRole,
    // a manually-created appointment is never paid via a customer's coupon or
    // package purchase - see bookAppointment's own mutual-exclusion check with
    // priceOverride, enforced again here so a stray couponCode/packagePurchaseId
    // in the admin form payload can never slip through
    couponCode: null,
    packagePurchaseId: null,
  });
}

async function transitionStatus(appointmentId, nextStatus, actorId, actorRole, extra = {}) {
  const appointment = await appointmentRepo.findAppointmentById(appointmentId);
  if (!appointment) notFound("Termin");
  if (!canAccessAppointment(appointment, actorId, actorRole)) forbidden("Nemate pristup ovom terminu");

  const allowed = getAllowedStatuses(appointment.status, actorRole);
  if (!allowed.includes(nextStatus)) {
    badRequest(`Prelaz iz statusa "${appointment.status}" u "${nextStatus}" nije dozvoljen`);
  }

  // Package-purchase session lifecycle: "completed" delivers the reserved session
  // (moves reserved -> used); "cancelled"/"rejected"/"no_show" gives the reservation
  // back - none of those three represent the service actually being delivered.
  // "completed" is terminal (nothing transitions out of it - see
  // appointment-status-transitions.js), so a session is never committed twice.
  if (appointment.packagePurchase) {
    if (nextStatus === "completed") {
      await packagePurchaseService.commitSession(appointment.packagePurchase, appointment.variant.servicePackageId);
    } else if (nextStatus === "cancelled" || nextStatus === "rejected" || nextStatus === "no_show") {
      await packagePurchaseService.releaseSession(appointment.packagePurchase, appointment.variant.servicePackageId);
    }
  }

  const updated = await appointmentRepo.updateAppointmentById(appointmentId, { status: nextStatus, ...extra });
  logInfo("Appointment status changed", { appointmentId, from: appointment.status, to: nextStatus, actorId, actorRole });

  eventEmitter.emit("appointment:status_changed", { appointmentId, status: nextStatus, previousStatus: appointment.status });

  const populated = await getPopulatedAppointment(appointmentId);
  return mapAppointment(populated, actorRole, "detail");
}

export async function confirmAppointment(appointmentId, actorId, actorRole) {
  return transitionStatus(appointmentId, "confirmed", actorId, actorRole, {
    confirmedBy: actorRole === "admin" ? "admin" : "employee",
    confirmedAt: new Date(),
  });
}

export async function rejectAppointment(appointmentId, reason, actorId, actorRole) {
  return transitionStatus(appointmentId, "rejected", actorId, actorRole, {
    rejectedBy: actorRole === "admin" ? "admin" : "employee",
    rejectedAt: new Date(),
    rejectionReason: reason || "",
  });
}

export async function cancelAppointment(appointmentId, reason, actorId, actorRole) {
  if (actorRole === "user") {
    const appointment = await appointmentRepo.findAppointmentById(appointmentId);
    if (!appointment) notFound("Termin");
    if (!canUserCancelAppointment(appointment.status, appointment.startTime)) {
      badRequest(`Termin se može otkazati najkasnije ${USER_CANCELLATION_CUTOFF_HOURS}h unapred`);
    }
  }

  return transitionStatus(appointmentId, "cancelled", actorId, actorRole, {
    cancelledBy: actorRole === "admin" ? "admin" : "user",
    cancelledAt: new Date(),
    cancellationReason: reason || "",
  });
}

export async function completeAppointment(appointmentId, actorId, actorRole) {
  return transitionStatus(appointmentId, "completed", actorId, actorRole);
}

export async function noShowAppointment(appointmentId, note, actorId, actorRole) {
  return transitionStatus(appointmentId, "no_show", actorId, actorRole, {
    noShowBy: actorRole === "admin" ? "admin" : "employee",
    noShowAt: new Date(),
    noShowNote: note || "",
  });
}

export async function reassignAppointment(appointmentId, newEmployeeId, actorId) {
  if (!newEmployeeId) validationError("newEmployeeId");

  const appointment = await appointmentRepo.findAppointmentById(appointmentId);
  if (!appointment) notFound("Termin");

  // captured before the update below overwrites it - google-calendar.listener.js
  // needs to know which employee (and therefore which calendar) this appointment
  // is moving AWAY from, since an event can't be "moved" between calendars via a
  // patch call, only deleted from one and recreated on the other.
  const previousEmployeeId = appointment.employee ? appointment.employee.toString() : null;

  const newEmployeeDoc = await employeeService.getEmployeeByIdRaw(newEmployeeId);
  if (!newEmployeeDoc) notFound("Zaposleni");
  if (!isEmployeeWorkingAt(newEmployeeDoc, appointment.startTime, appointment.endTime)) {
    badRequest("Izabrani zaposleni ne radi u terminu ovog zakazivanja");
  }

  const overlapping = await appointmentRepo.findOverlappingAppointments(newEmployeeId, appointment.startTime, appointment.endTime, appointmentId);
  if (overlapping.length > 0) badRequest("Izabrani terapeut nije dostupan u ovom terminu");

  // Reassigning WHO performs the appointment doesn't change WHAT resources it
  // occupies (still the same appointment, same time, same service) - so no
  // resource-capacity re-check is needed here, only the employee-overlap one
  // above.
  const employeeName = await employeeService.getEmployeeNameById(newEmployeeId);

  const updated = await appointmentRepo.updateAppointmentById(appointmentId, {
    employee: newEmployeeId,
    employeeSnapshot: { name: employeeName },
    // `assignedTo` is what mapAppointment's "dodeljenTerapeut"/"dodelio"/"dodeljenU"
    // fields and the /admin/termini "unassigned" queue filter actually read - it
    // must be set to the same employee being assigned here, not left null, or the
    // admin detail page silently shows an empty "assigned therapist" despite
    // assignedBy/assignedAt being populated right below it.
    assignedTo: newEmployeeId,
    assignedBy: "admin",
    assignedAt: new Date(),
  });

  logInfo("Appointment reassigned", { appointmentId, newEmployeeId, actorId });
  eventEmitter.emit("appointment:reassigned", { appointmentId, newEmployeeId: newEmployeeId.toString(), previousEmployeeId });
  const populated = await getPopulatedAppointment(updated._id);
  return mapAppointment(populated, "admin", "detail");
}

/**
 * Moves an existing appointment to a new start time - same employee, same
 * service/resources, only the window changes. Distinct action from
 * reassignAppointment (which changes WHO, not WHEN).
 *
 * Business rules (see appointment-cancellation.util.js for the actual checks):
 * - Tiered by how close we are to the CURRENT appointment's start time, for
 *   non-admin actors (admin bypasses this tier entirely - staff override):
 *     >= RESCHEDULE_CUTOFF_HOURS away  -> any future day/time
 *     RESCHEDULE_SAME_DAY_FLOOR_HOURS to RESCHEDULE_CUTOFF_HOURS -> same
 *       calendar day as the current appointment only
 *     < RESCHEDULE_SAME_DAY_FLOOR_HOURS -> not allowed at all
 * - The NEW time must ALWAYS have at least RESCHEDULE_MIN_LEAD_MINUTES of lead
 *   from right now - this one applies to every actor including admin, since
 *   it's a baseline sanity/prep-time floor rather than a customer-facing
 *   protection.
 * - The new window still has to clear the exact same availability checks a
 *   fresh booking would (employee's working hours, no overlap, resource
 *   capacity) - moving a slot doesn't get to skip the checks that created it.
 */
export async function rescheduleAppointment(appointmentId, newStartTime, actorId, actorRole) {
  if (!appointmentId) validationError("appointmentId");
  if (!newStartTime) validationError("newStartTime");

  const appointment = await appointmentRepo.findAppointmentById(appointmentId);
  if (!appointment) notFound("Termin");
  if (!canAccessAppointment(appointment, actorId, actorRole)) forbidden("Nemate pristup ovom terminu");

  if (!["pending", "confirmed"].includes(appointment.status)) {
    badRequest(`Termin sa statusom "${appointment.status}" se ne može pomeriti`);
  }

  const newStart = newStartTime instanceof Date ? newStartTime : new Date(newStartTime);
  if (isNaN(newStart.getTime())) badRequest("Neispravno novo vreme termina");
  if (!hasMinimumRescheduleLeadTime(newStart)) {
    badRequest(`Izabrano vreme mora biti bar ${RESCHEDULE_MIN_LEAD_MINUTES} minuta unapred`);
  }

  // admin bypasses the tiered window entirely (staff override) - everyone else
  // gets checked against how close we already are to the CURRENT appointment
  if (actorRole !== "admin") {
    const window = getRescheduleWindow(appointment.status, appointment.startTime);

    if (window === "forbidden") {
      badRequest(`Termin se više ne može pomeriti - manje je od ${RESCHEDULE_SAME_DAY_FLOOR_HOURS}h do termina`);
    }

    if (window === "same_day_only" && !isSameCalendarDay(newStart, appointment.startTime)) {
      badRequest(`Kada je manje od ${RESCHEDULE_CUTOFF_HOURS}h do termina, novo vreme mora biti isti dan`);
    }
  }

  const newEnd = new Date(newStart.getTime() + appointment.variant.duration * 60000);

  if (appointment.employee) {
    const employeeDoc = await employeeService.getEmployeeByIdRaw(appointment.employee);
    if (!employeeDoc) notFound("Zaposleni");
    if (!isEmployeeWorkingAt(employeeDoc, newStart, newEnd)) {
      badRequest("Zaposleni ne radi u izabranom novom terminu");
    }

    const overlapping = await appointmentRepo.findOverlappingAppointments(appointment.employee, newStart, newEnd, appointmentId);
    if (overlapping.length > 0) badRequest("Izabrano novo vreme više nije dostupno, izaberite drugo");
  }

  for (const { resource } of appointment.resources || []) {
    const resourceDoc = await resourceService.getResourceByIdRaw(resource);
    const capacity = resourceService.getEffectiveCapacity(resourceDoc);
    if (!capacity) badRequest("Resurs potreban za ovu uslugu trenutno nije dostupan");
    const resourceCount = await appointmentRepo.countOverlappingResourceAppointments(resource, newStart, newEnd, appointmentId);
    if (resourceCount >= capacity) badRequest("Izabrano novo vreme nije dostupno (resurs je zauzet), izaberite drugo");
  }

  let updated;
  try {
    updated = await appointmentRepo.updateAppointmentById(appointmentId, { startTime: newStart, endTime: newEnd });
  } catch (error) {
    // same E11000 race-guard reasoning as bookAppointment - the unique
    // (employee, startTime) index is the final word if two changes collided
    if (error.code === 11000) badRequest("Izabrano novo vreme je upravo zauzeto, pokušajte ponovo");
    throw error;
  }

  logInfo("Appointment rescheduled", { appointmentId, oldStartTime: appointment.startTime, newStartTime: newStart, actorId, actorRole });
  eventEmitter.emit("appointment:rescheduled", { appointmentId, oldStartTime: appointment.startTime, newStartTime: newStart });

  const populated = await getPopulatedAppointment(updated._id);
  return mapAppointment(populated, actorRole, "detail");
}

// Written by google-calendar.listener.js after a successful push/move to Google
// Calendar - not part of the normal appointment lifecycle, so it deliberately
// skips getPopulatedAppointment/mapAppointment and doesn't emit any event of its
// own (nothing downstream needs to react to "the calendar id changed").
export async function setGoogleEventId(appointmentId, googleEventId) {
  if (!appointmentId) validationError("appointmentId");
  await appointmentRepo.updateAppointmentById(appointmentId, { googleEventId });
}

// Narrow raw getter for google-calendar.listener.js - googleEventId is never
// exposed on any mapped shape (it's sync-internal bookkeeping, not something any
// UI needs to show), so the mapped getAppointmentById can't be reused here.
export async function getGoogleEventId(appointmentId) {
  if (!appointmentId) return null;
  const appointment = await appointmentRepo.findAppointmentById(appointmentId);
  return appointment?.googleEventId || null;
}

export async function deleteAppointmentById(appointmentId, actorId) {
  if (!appointmentId) validationError("appointmentId");
  const appointment = await appointmentRepo.findAppointmentById(appointmentId);
  if (!appointment) notFound("Termin");

  // if this appointment still holds a reserved (not yet committed/released) package
  // session, give it back before deleting - otherwise the customer's package would
  // show a phantom reservation that can never be used or released (see
  // package-purchase.service.js's reserveSession/releaseSession/commitSession)
  if (appointment.packagePurchase && (appointment.status === "pending" || appointment.status === "confirmed")) {
    await packagePurchaseService.releaseSession(appointment.packagePurchase, appointment.variant.servicePackageId);
  }

  await appointmentRepo.deleteAppointmentById(appointmentId);
  logInfo("Appointment deleted", { appointmentId, actorId });

  // Fired with employeeId/googleEventId captured above (the doc is gone by now,
  // so google-calendar.listener.js can't re-fetch it the way the other handlers
  // do) - without this, a hard-deleted appointment left its Google Calendar
  // event behind forever, silently blocking a slot nobody actually has anymore.
  eventEmitter.emit("appointment:deleted", {
    appointmentId,
    employeeId: appointment.employee ? appointment.employee.toString() : null,
    googleEventId: appointment.googleEventId || null,
  });

  return { success: true };
}

/**
 * Confirmed appointments due for a given reminder window, already mapped to the
 * same "user" detail shape the email templates already expect (see
 * appointment-confirmation.ejs's appointment.usluga/termin/terapeut fields) -
 * used by appointment-reminder-jobs.js.
 */
export async function findAppointmentsDueForReminder(sentAtField, windowHours) {
  const due = await appointmentRepo.findAppointmentsDueForReminder(sentAtField, windowHours);
  return Promise.all(due.map((a) => getPopulatedAppointment(a._id).then((full) => mapAppointment(full, "user", "detail"))));
}

export async function markReminderSent(appointmentId, sentAtField) {
  return appointmentRepo.updateAppointmentById(appointmentId, { [sentAtField]: new Date() });
}

export default {
  findAppointments,
  getAppointmentById,
  getAppointmentForCommission,
  getBusyIntervals,
  getResourceBusyIntervals,
  hasOverlappingAppointment,
  countOverlappingResourceAppointments,
  bookAppointment,
  createManualAppointment,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
  noShowAppointment,
  reassignAppointment,
  rescheduleAppointment,
  deleteAppointmentById,
  setGoogleEventId,
  getGoogleEventId,
  findAppointmentsDueForReminder,
  markReminderSent,
};