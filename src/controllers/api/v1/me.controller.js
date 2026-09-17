import * as userService from "../../../services/user.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import * as orderService from "../../../services/order.service.js";
import * as authService from "../../../services/auth.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";

// Every action here mirrors controllers/web/user/user.controller.js and
// controllers/web/auth/auth.controller.js's changePassword/deactivateAccount -
// same services, same audit log calls (req.user has the same id/email/roleName
// shape recordAuditLog reads from actor, whether it came from a session or a
// verified JWT - see auth.middleware.js). The difference is entirely in what
// happens with the result: no view to re-render on a validation error, no session
// to update after a profile edit, no session to destroy on deactivation - a
// Bearer-token client just gets a JSON response and discards its own token.

// ---- Profile ----

export async function getProfile(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.user.id);
    return res.json({ success: true, data: user });
  } catch (error) {
    logError("[api/getProfile] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const existing = await userService.findUserProfile(req.user.id);
    const updated = await userService.updateProfile(req.user.id, req.body);

    logInfo(`[api/updateProfile] Korisnik #${req.user.id} ažurirao podešavanja`, { userId: req.user.id });
    const changes = auditLogService.computeChanges(existing, updated, ["firstName", "lastName", "telefon"]);
    await auditLogService.recordAuditLog({ actor: req.user, action: "USER_SETTINGS_UPDATED", entity: { type: "User", id: req.user.id }, changes, req, success: true });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/updateProfile] Greška", error, { userId: req.user.id, body: req.body });
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.oldPassword, req.body.newPassword, req.body.confirmPassword);
    logInfo(`[api/changePassword] Korisnik #${req.user.id} promenio lozinku`, { userId: req.user.id });
    return res.json({ success: true, data: { message: "Lozinka je uspešno promenjena." } });
  } catch (error) {
    logError("[api/changePassword] Greška", error, { userId: req.user.id });
    next(error);
  }
}

// No session to destroy (see auth.controller.js's deactivateAccount) - a Bearer
// token stays technically valid until it expires (see auth.service.js's signJwt -
// 1 day by default), it just stops passing any gate that checks the account is
// still active server-side, the same way a stale session would.
export async function deactivateAccount(req, res, next) {
  try {
    await authService.deactivateAccount(req.user.id, req.body.password);
    logInfo(`[api/deactivateAccount] Korisnik #${req.user.id} deaktivirao nalog`, { userId: req.user.id });
    return res.json({ success: true, data: { message: "Nalog je deaktiviran." } });
  } catch (error) {
    logError("[api/deactivateAccount] Greška", error, { userId: req.user.id });
    next(error);
  }
}

// ---- Appointments ----

export async function listAppointments(req, res, next) {
  try {
    const { status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      requesterId: req.user.id,
      role: "user",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    logError("[api/listAppointments] Greška", error, { userId: req.user.id, query: req.query });
    next(error);
  }
}

export async function getAppointment(req, res, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.appointmentId, req.user.id, "user");
    return res.json({ success: true, data: appointment });
  } catch (error) {
    logError("[api/getAppointment] Greška", error, { appointmentId: req.params.appointmentId, userId: req.user.id });
    next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.cancelAppointment(appointmentId, req.body.reason, req.user.id, "user");
    logInfo(`[api/cancelAppointment] Korisnik otkazao termin #${appointmentId}`, { appointmentId, userId: req.user.id });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "APPOINTMENT_CANCELLED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });

    return res.json({ success: true, data: { message: "Termin je uspešno otkazan." } });
  } catch (error) {
    logError("[api/cancelAppointment] Greška", error, { appointmentId: req.params.appointmentId, userId: req.user.id });
    next(error);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const existing = await appointmentService.getAppointmentById(appointmentId, req.user.id, "user").catch(() => null);
    const updated = await appointmentService.rescheduleAppointment(appointmentId, req.body.newStartTime, req.user.id, "user");

    logInfo(`[api/rescheduleAppointment] Korisnik pomerio termin #${appointmentId}`, { appointmentId, userId: req.user.id });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "APPOINTMENT_RESCHEDULED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { pocetak: { old: existing?.termin?.pocetakRaw ?? null, new: req.body.newStartTime || null } },
      req,
      success: true,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/rescheduleAppointment] Greška", error, { appointmentId: req.params.appointmentId, userId: req.user.id });
    next(error);
  }
}

// ---- Orders ----

export async function listOrders(req, res, next) {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const result = await orderService.findOrders({
      requesterId: req.user.id,
      role: "user",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    logError("[api/listOrders] Greška", error, { userId: req.user.id, query: req.query });
    next(error);
  }
}

export async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderById(req.params.orderId, req.user.id, "user");
    return res.json({ success: true, data: order });
  } catch (error) {
    logError("[api/getOrder] Greška", error, { orderId: req.params.orderId, userId: req.user.id });
    next(error);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.cancelOrder(orderId, req.body.reason, req.user.id, "user");
    logInfo(`[api/cancelOrder] Korisnik otkazao porudžbinu #${orderId}`, { orderId, userId: req.user.id });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "ORDER_CANCELLED",
      entity: { type: "Order", id: orderId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });

    return res.json({ success: true, data: { message: "Porudžbina je uspešno otkazana." } });
  } catch (error) {
    logError("[api/cancelOrder] Greška", error, { orderId: req.params.orderId, userId: req.user.id });
    next(error);
  }
}

// ---- Addresses ----

export async function listAddresses(req, res, next) {
  try {
    const addresses = await userService.getAddresses(req.user.id);
    return res.json({ success: true, data: addresses });
  } catch (error) {
    logError("[api/listAddresses] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function addAddress(req, res, next) {
  try {
    // addAddress (user.service.js) returns the full updated address list, not just
    // the one just added (same as getAddresses) - matches that here.
    const addresses = await userService.addAddress(req.user.id, {
      label: req.body.label,
      city: req.body.city,
      postalCode: req.body.postalCode,
      street: req.body.street,
      number: req.body.number,
      isDefault: req.body.isDefault === true || req.body.isDefault === "true",
    });
    logInfo("[api/addAddress] Adresa dodata", { userId: req.user.id });
    await auditLogService.recordAuditLog({ actor: req.user, action: "USER_ADDRESS_ADDED", entity: { type: "User", id: req.user.id }, req, success: true });

    return res.status(201).json({ success: true, data: addresses });
  } catch (error) {
    logError("[api/addAddress] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function removeAddress(req, res, next) {
  try {
    const { addressId } = req.params;
    await userService.removeAddress(req.user.id, addressId);
    logInfo("[api/removeAddress] Adresa uklonjena", { userId: req.user.id, addressId });
    await auditLogService.recordAuditLog({ actor: req.user, action: "USER_ADDRESS_REMOVED", entity: { type: "User", id: req.user.id }, req, success: true });

    return res.json({ success: true, data: { message: "Adresa je uklonjena." } });
  } catch (error) {
    logError("[api/removeAddress] Greška", error, { addressId: req.params.addressId, userId: req.user.id });
    next(error);
  }
}

export async function setDefaultAddress(req, res, next) {
  try {
    const { addressId } = req.params;
    await userService.setDefaultAddress(req.user.id, addressId);
    logInfo("[api/setDefaultAddress] Podrazumevana adresa promenjena", { userId: req.user.id, addressId });
    await auditLogService.recordAuditLog({
      actor: req.user,
      action: "USER_DEFAULT_ADDRESS_CHANGED",
      entity: { type: "User", id: req.user.id },
      changes: { addressId: { old: null, new: addressId } },
      req,
      success: true,
    });

    return res.json({ success: true, data: { message: "Podrazumevana adresa je ažurirana." } });
  } catch (error) {
    logError("[api/setDefaultAddress] Greška", error, { addressId: req.params.addressId, userId: req.user.id });
    next(error);
  }
}

export default {
  getProfile, updateProfile, changePassword, deactivateAccount,
  listAppointments, getAppointment, cancelAppointment, rescheduleAppointment,
  listOrders, getOrder, cancelOrder,
  listAddresses, addAddress, removeAddress, setDefaultAddress,
};
