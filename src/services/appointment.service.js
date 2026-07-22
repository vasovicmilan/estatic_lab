import mongoose from "mongoose";
import eventEmitter from "../events/event.emitter.js";
import appointmentRepo from "../repositories/appointment.repository.js";
import userService from "./user.service.js";
import serviceService from "./service.service.js";
import couponService from "./coupon.service.js";
import availabilityService from "./availability.service.js";
import packagePurchaseService from "./package-purchase.service.js";
import { mapAppointment, mapAppointmentsForAdminList } from "../mappers/appointment.mapper.js";
import { getAllowedStatuses } from "../models/appointment-status-transitions.js";
import { canUserCancelAppointment } from "../utils/appointment-cancellation.util.js";
import { USER_CANCELLATION_CUTOFF_HOURS } from "../config/booking.config.js";
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
    populateFields: ["employee", { path: "coupon", populate: "partner" }],
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
 * Whether an employee has any appointment overlapping the given window - for
 * availability.service.js's write-time final-check before actually booking,
 * since the slot list the visitor saw may be a few seconds stale by then.
 */
export async function hasOverlappingAppointment(employeeId, startTime, endTime, { session } = {}) {
  const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, startTime, endTime, null, { session });
  return overlapping.length > 0;
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
  } = input;

  if (!serviceId) validationError("serviceId");
  if (!servicePackageId) validationError("servicePackageId");
  if (!startTime) validationError("startTime");
  if (!contact.email) validationError("email");
  if (!contact.firstName) validationError("firstName");
  if (packagePurchaseId && !isLoggedIn) badRequest("Plaćanje paketom je dostupno samo prijavljenim korisnicima");

  const start = startTime instanceof Date ? startTime : new Date(startTime);
  if (isNaN(start.getTime())) badRequest("Neispravno vreme termina");
  if (start < new Date()) badRequest("Ne možete zakazati termin u prošlosti");

  // ---- reads before the transaction ----
  const { variant } = await serviceService.getActiveVariant(serviceId, servicePackageId);
  const end = new Date(start.getTime() + variant.duration * 60000);

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

  if (employeeId) {
    const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, start, end);
    if (overlapping.length > 0) badRequest("Izabrani termin više nije dostupan, izaberite drugi");
    chosenEmployeeId = employeeId;
  } else {
    // no employee explicitly chosen by the customer - verify the slot is actually
    // deliverable by SOMEONE before accepting the booking, but don't silently commit
    // to whichever employee happens to be free first. The appointment is created
    // unassigned; an admin picks the therapist from the appointment details page
    // (see reassignAppointment) - see appointment-status-transitions.js/admin.routes.js
    // for why this moved from automatic to admin-driven.
    const someoneFree = await availabilityService.findFirstAvailableEmployee(serviceId, start, end);
    if (!someoneFree) badRequest("Nijedan terapeut nije dostupan za izabrani termin, izaberite drugi");
  }

  let couponResult = null;
  let resolvedPackagePurchase = null;

  if (packagePurchaseId) {
    resolvedPackagePurchase = await packagePurchaseService.assertUsablePurchase(packagePurchaseId, buyerId, servicePackageId);
  } else if (couponCode) {
    couponResult = await couponService.validateCouponForBooking(couponCode, {
      userId: buyerId,
      serviceId,
      appointmentValue: variant.totalPrice,
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
      } else {
        const stillSomeoneFree = await availabilityService.findFirstAvailableEmployee(serviceId, start, end, { session });
        if (!stillSomeoneFree) badRequest("Izabrani termin je upravo zauzet, pokušajte ponovo");
      }

      const discountApplied = couponResult?.discountAmount || 0;

      created = await appointmentRepo.createAppointment(
        {
          user: buyerId,
          service: serviceId,
          variant: {
            servicePackageId,
            name: variant.name,
            duration: variant.duration,
            price: variant.totalPrice,
          },
          employee: chosenEmployeeId,
          assignedTo: null,
          assignedBy: null,
          assignedAt: null,
          startTime: start,
          endTime: end,
          status: "pending",
          note,
          coupon: couponResult?.coupon._id || null,
          packagePurchase: resolvedPackagePurchase?._id || null,
          discountApplied,
          finalPrice: resolvedPackagePurchase ? 0 : Math.max(0, variant.totalPrice - discountApplied),
          contactSnapshot: {
            firstName: contact.firstName,
            lastName: contact.lastName || "",
            email: contact.email,
            phone: contact.phone || "",
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
    logError("Appointment booking transaction failed", error, { serviceId, servicePackageId, startTime: start });
    throw error;
  } finally {
    await session.endSession();
  }

  logInfo("Appointment booked", { appointmentId: created._id, serviceId, userId: String(buyerId), accountJustCreated });

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

  const overlapping = await appointmentRepo.findOverlappingAppointments(newEmployeeId, appointment.startTime, appointment.endTime, appointmentId);
  if (overlapping.length > 0) badRequest("Izabrani terapeut nije dostupan u ovom terminu");

  const updated = await appointmentRepo.updateAppointmentById(appointmentId, {
    employee: newEmployeeId,
    assignedTo: null,
    assignedBy: "admin",
    assignedAt: new Date(),
  });

  logInfo("Appointment reassigned", { appointmentId, newEmployeeId, actorId });
  eventEmitter.emit("appointment:reassigned", { appointmentId, newEmployeeId: newEmployeeId.toString() });
  const populated = await getPopulatedAppointment(updated._id);
  return mapAppointment(populated, "admin", "detail");
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
  return { success: true };
}

export default {
  findAppointments,
  getAppointmentById,
  getAppointmentForCommission,
  getBusyIntervals,
  hasOverlappingAppointment,
  bookAppointment,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
  noShowAppointment,
  reassignAppointment,
  deleteAppointmentById,
};