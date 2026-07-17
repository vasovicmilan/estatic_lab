import eventEmitter from "../event.emitter.js";
import * as emailService from "../../services/email.service.js";
import * as appointmentService from "../../services/appointment.service.js";
import * as employeeService from "../../services/employee.service.js";
import * as packagePurchaseService from "../../services/package-purchase.service.js";
import { logError } from "../../utils/logger.util.js";

/**
 * This module's only job is registering `eventEmitter.on(...)` handlers - importing it
 * once (see server.js) is enough, nothing needs to be called. Split out from
 * event.emitter.js itself so the emitter stays a dumb, dependency-free singleton that
 * every service can import without pulling in email/appointment/etc. services
 * transitively.
 *
 * Every handler is wrapped in `safe()`: by the time any of these events fire, the
 * action they're reacting to (booking, registration, password reset...) has already
 * succeeded and already returned a response to the user. A failed notification email
 * must never surface as a 500 to someone who successfully booked an appointment - it
 * gets logged instead.
 */
function safe(eventName, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      logError(`[email listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

// ==================== ACCOUNT ====================

eventEmitter.on(
  "user:registered",
  safe("user:registered", async ({ email, firstName, confirmToken }) => {
    // Google sign-ins emit this too but with no confirmToken - their email is already
    // verified by Google, so there's nothing to confirm and nothing to send.
    if (!confirmToken) return;
    await emailService.sendAccountConfirmationEmail({ email, firstName }, confirmToken);
  })
);

eventEmitter.on(
  "user:confirmation_resent",
  safe("user:confirmation_resent", async ({ email, firstName, confirmToken }) => {
    await emailService.sendAccountConfirmationEmail({ email, firstName }, confirmToken);
  })
);

eventEmitter.on(
  "user:password_reset_requested",
  safe("user:password_reset_requested", async ({ email, firstName, resetToken }) => {
    await emailService.sendPasswordResetEmail({ email, firstName }, resetToken);
  })
);

eventEmitter.on(
  "user:password_changed",
  safe("user:password_changed", async ({ email, firstName }) => {
    await emailService.sendPasswordChangedEmail({ email, firstName });
  })
);

eventEmitter.on(
  "user:deactivated",
  safe("user:deactivated", async ({ email, firstName }) => {
    await emailService.sendAccountDeactivatedEmail({ email, firstName });
  })
);

// user:confirmed fires when the confirmation link is actually clicked - the
// confirmation email itself was already sent on user:registered, and there's no
// "welcome, you're verified" email defined, so intentionally no listener here.

eventEmitter.on(
  "user:guest_created",
  safe("user:guest_created", async ({ email, firstName, resetToken }) => {
    await emailService.sendClaimAccountEmail({ email, firstName }, resetToken);
  })
);

// ==================== APPOINTMENTS ====================

eventEmitter.on(
  "appointment:created",
  safe("appointment:created", async ({ appointmentId, email, firstName }) => {
    // event payload only carries the booker's contact info - admin role bypasses the
    // usual requester ownership check (see appointment.service.js's canAccessAppointment),
    // which is fine here since this is a trusted, system-triggered read, not a user request
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    await emailService.sendAppointmentReceivedEmail({ email, firstName }, appointment);
    await emailService.notifyAdminNewAppointment(appointment);
  })
);

eventEmitter.on(
  "appointment:status_changed",
  safe("appointment:status_changed", async ({ appointmentId, status }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    const email = appointment.korisnik?.email;
    const firstName = appointment.korisnik?.ime;
    if (!email) return;

    if (status === "confirmed") {
      await emailService.sendAppointmentConfirmedEmail({ email, firstName }, appointment);
    } else if (status === "cancelled") {
      await emailService.sendAppointmentCancelledEmail({ email, firstName }, appointment);
      await emailService.notifyAdminAppointmentCancelled(appointment);
    } else {
      // rejected, completed, no_show - generic fallback template
      await emailService.sendAppointmentStatusUpdateEmail({ email, firstName }, appointment, appointment.status);
    }
  })
);

eventEmitter.on(
  "appointment:reassigned",
  safe("appointment:reassigned", async ({ appointmentId, newEmployeeId }) => {
    const [appointment, employee] = await Promise.all([
      appointmentService.getAppointmentById(appointmentId, null, "admin"),
      employeeService.getEmployeeById(newEmployeeId, "admin", "detail"),
    ]);
    if (!employee?.korisnik?.email) return;
    await emailService.sendAppointmentReassignedEmail(
      { email: employee.korisnik.email, firstName: employee.korisnik.imePrezime },
      appointment
    );
  })
);

// ==================== PACKAGES ====================

eventEmitter.on(
  "package_purchase:created",
  safe("package_purchase:created", async ({ packagePurchaseId }) => {
    const purchase = await packagePurchaseService.getPurchaseById(packagePurchaseId);
    if (!purchase.korisnikEmail) return;
    await emailService.sendPackagePurchaseCreatedEmail({ email: purchase.korisnikEmail, firstName: purchase.korisnik }, purchase);
  })
);

eventEmitter.on(
  "package_purchase:cancelled",
  safe("package_purchase:cancelled", async ({ packagePurchaseId }) => {
    const purchase = await packagePurchaseService.getPurchaseById(packagePurchaseId);
    if (!purchase.korisnikEmail) return;
    await emailService.sendPackagePurchaseCancelledEmail({ email: purchase.korisnikEmail, firstName: purchase.korisnik }, purchase);
  })
);

// ==================== MARKETING ====================

eventEmitter.on(
  "contact:created",
  safe("contact:created", async (contact) => {
    await emailService.notifyAdminNewContact(contact);
  })
);

eventEmitter.on(
  "testimonial:submitted",
  safe("testimonial:submitted", async (testimonial) => {
    await emailService.notifyAdminNewTestimonial(testimonial);
  })
);

eventEmitter.on(
  "newsletter:subscribed",
  safe("newsletter:subscribed", async ({ email, unsubscribeToken }) => {
    await emailService.sendNewsletterWelcomeEmail({ email }, unsubscribeToken);
  })
);

export default eventEmitter;