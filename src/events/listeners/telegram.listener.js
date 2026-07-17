import eventEmitter from "../event.emitter.js";
import * as telegramService from "../../services/telegram.service.js";
import * as appointmentService from "../../services/appointment.service.js";
import * as employeeService from "../../services/employee.service.js";
import * as packagePurchaseService from "../../services/package-purchase.service.js";
import { translateStatus } from "../../mappers/appointment.mapper.js";
import {
  buildNewAppointmentMessage,
  buildAppointmentCancelledMessage,
  buildAppointmentStatusChangeMessage,
  buildNewContactMessage,
  buildNewTestimonialMessage,
  buildNewUserMessage,
  buildNewPackagePurchaseMessage,
  buildAppointmentReassignedMessage,
} from "../../utils/telegram-message.util.js";
import { logError } from "../../utils/logger.util.js";

const BASE_URL = process.env.BASE_URL || "https://beautymedica.rs";

/**
 * Same shape and reasoning as email.listeners.js: this module's only job is
 * registering eventEmitter.on(...) handlers (imported once in server.js). The
 * message-building logic already existed in telegram-message.util.js and the raw
 * sender already existed in telegram.service.js - neither was ever actually wired to
 * a domain event, exactly the same gap email had.
 *
 * Every handler is wrapped in safe(): a failed Telegram alert must never surface as a
 * 500 to whoever triggered the underlying action (it's a side notification, not part
 * of the request/response cycle) - logged instead.
 */
function safe(eventName, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      logError(`[telegram listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

// telegram-message.util.js's builders expect a flat shape (firstName, lastName,
// email, serviceName, startTime, finalPrice as a raw number) - the admin-mapped
// appointment (appointment.mapper.js) is nested and HTML-formatted for display in
// admin views instead. This adapts one into the other rather than duplicating a
// second appointment-shaping path.
function toFlatAppointment(appointment) {
  const [firstName, ...rest] = (appointment.korisnik?.ime || "").split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
    email: appointment.korisnik?.email,
    phone: appointment.korisnik?.telefon,
    serviceName: appointment.usluga?.naziv,
    duration: appointment.usluga?.trajanje,
    startTime: appointment.termin?.pocetak,
    finalPrice: parseFloat(appointment.konacnaCena) || 0,
    therapist: appointment.terapeut || appointment.dodeljenTerapeut || null,
    note: appointment.napomena,
    coupon: appointment.kupon,
    cancelledBy: appointment.otkazao || null,
    cancelReason: appointment.razlogOtkazivanja || null,
    adminUrl: appointment.id ? `${BASE_URL}/admin/termini/detalji/${appointment.id}` : null,
  };
}

// ==================== APPOINTMENTS ====================

eventEmitter.on(
  "appointment:created",
  safe("appointment:created", async ({ appointmentId }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    const text = buildNewAppointmentMessage(toFlatAppointment(appointment));
    await telegramService.sendTelegramMessage("APPOINTMENTS", text);
  })
);

eventEmitter.on(
  "appointment:status_changed",
  safe("appointment:status_changed", async ({ appointmentId, status, previousStatus }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    const flat = toFlatAppointment(appointment);

    if (status === "cancelled") {
      await telegramService.sendTelegramMessage("APPOINTMENTS", buildAppointmentCancelledMessage(flat));
      return;
    }

    const text = buildAppointmentStatusChangeMessage(flat, translateStatus(previousStatus), translateStatus(status));
    await telegramService.sendTelegramMessage("APPOINTMENTS", text);
  })
);

eventEmitter.on(
  "appointment:reassigned",
  safe("appointment:reassigned", async ({ appointmentId, newEmployeeId }) => {
    const [appointment, employee] = await Promise.all([
      appointmentService.getAppointmentById(appointmentId, null, "admin"),
      employeeService.getEmployeeById(newEmployeeId, "admin", "detail"),
    ]);
    const text = buildAppointmentReassignedMessage(appointment, employee?.korisnik?.imePrezime);
    await telegramService.sendTelegramMessage("APPOINTMENTS", text);
  })
);

// ==================== CONTACTS ====================

eventEmitter.on(
  "contact:created",
  safe("contact:created", async (contact) => {
    const text = buildNewContactMessage(contact);
    await telegramService.sendTelegramMessage("CONTACTS", text);
  })
);

// ==================== TESTIMONIALS ====================

eventEmitter.on(
  "testimonial:submitted",
  safe("testimonial:submitted", async (testimonial) => {
    const text = buildNewTestimonialMessage(testimonial);
    await telegramService.sendTelegramMessage("TESTIMONIALS", text);
  })
);

// ==================== USERS ====================

eventEmitter.on(
  "user:registered",
  safe("user:registered", async (user) => {
    const text = buildNewUserMessage(user);
    await telegramService.sendTelegramMessage("USERS", text);
  })
);

// ==================== PACKAGES ====================
// no dedicated PACKAGES thread in telegram.config.js - routed to APPOINTMENTS, same
// reasoning as the email side. Add a PACKAGES thread env var + config entry if you'd
// rather split it out (see telegram.config.js).

eventEmitter.on(
  "package_purchase:created",
  safe("package_purchase:created", async ({ packagePurchaseId }) => {
    const purchase = await packagePurchaseService.getPurchaseById(packagePurchaseId);
    const text = buildNewPackagePurchaseMessage(purchase);
    await telegramService.sendTelegramMessage("APPOINTMENTS", text);
  })
);

export default eventEmitter;