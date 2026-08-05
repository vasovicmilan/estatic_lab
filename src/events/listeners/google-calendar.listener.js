import eventEmitter from "../event.emitter.js";
import * as googleCalendarService from "../../services/google-calendar.service.js";
import * as appointmentService from "../../services/appointment.service.js";
import * as employeeService from "../../services/employee.service.js";
import { logError } from "../../utils/logger.util.js";

/**
 * Same shape and reasoning as telegram.listener.js/email.listener.js: this module's
 * only job is registering eventEmitter.on(...) handlers (imported once in server.js).
 *
 * Calendar sync is a side effect of the appointment lifecycle, never a blocker for
 * it - every handler is wrapped in safe() so a Google API hiccup (rate limit,
 * expired sharing permission, transient network error) surfaces as a log line,
 * never as a failure visible to whoever booked/cancelled/reassigned the appointment.
 */
function safe(eventName, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      logError(`[google-calendar listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

// Statuses whose calendar event should be deleted the moment the appointment
// reaches them - the slot is genuinely free again, and (per Milan) there's no
// need for SrediMe or anyone else reading this calendar to see a record of
// something that was booked and then fell through, even though the appointment
// itself stays in our own database with this status.
const FREED_STATUSES = ["cancelled", "rejected"];

// Still occupying the slot - keep the event's details current on any change.
const ACTIVE_STATUSES = ["pending", "confirmed"];

// completed/no_show intentionally do neither: those only ever happen to
// appointments already in the past, so there's no future double-booking risk
// either way, and leaving the event in place keeps it as a historical record
// on the calendar without extra work.

eventEmitter.on(
  "appointment:created",
  safe("appointment:created", async ({ appointmentId }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    if (!appointment.terapeutId) return; // no employee assigned yet - nothing to sync until reassignAppointment sets one

    const employee = await employeeService.getEmployeeByIdRaw(appointment.terapeutId);
    if (!employee?.googleCalendarId) return;

    const googleEventId = await googleCalendarService.createEventForAppointment(appointment, employee.googleCalendarId);
    if (googleEventId) await appointmentService.setGoogleEventId(appointmentId, googleEventId);
  })
);

eventEmitter.on(
  "appointment:status_changed",
  safe("appointment:status_changed", async ({ appointmentId, status }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    if (!appointment.terapeutId) return;

    const employee = await employeeService.getEmployeeByIdRaw(appointment.terapeutId);
    if (!employee?.googleCalendarId) return;

    const googleEventId = await appointmentService.getGoogleEventId(appointmentId);
    if (!googleEventId) return;

    if (FREED_STATUSES.includes(status)) {
      await googleCalendarService.deleteEventForAppointment(employee.googleCalendarId, googleEventId);
      await appointmentService.setGoogleEventId(appointmentId, null);
      return;
    }

    if (ACTIVE_STATUSES.includes(status)) {
      await googleCalendarService.updateEventForAppointment(appointment, employee.googleCalendarId, googleEventId);
    }
    // completed/no_show - leave the existing event untouched
  })
);

eventEmitter.on(
  "appointment:reassigned",
  safe("appointment:reassigned", async ({ appointmentId, newEmployeeId, previousEmployeeId }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    const googleEventId = await appointmentService.getGoogleEventId(appointmentId);

    const [previousEmployee, newEmployee] = await Promise.all([
      previousEmployeeId ? employeeService.getEmployeeByIdRaw(previousEmployeeId) : null,
      employeeService.getEmployeeByIdRaw(newEmployeeId),
    ]);

    // remove from the old employee's calendar, if it was ever placed there
    if (googleEventId && previousEmployee?.googleCalendarId) {
      await googleCalendarService.deleteEventForAppointment(previousEmployee.googleCalendarId, googleEventId);
      await appointmentService.setGoogleEventId(appointmentId, null);
    }

    // create fresh on the new employee's calendar - an event can't be "moved"
    // between two different Google Calendars via a patch call, only deleted from
    // one and recreated on the other
    if (newEmployee?.googleCalendarId) {
      const newGoogleEventId = await googleCalendarService.createEventForAppointment(appointment, newEmployee.googleCalendarId);
      if (newGoogleEventId) await appointmentService.setGoogleEventId(appointmentId, newGoogleEventId);
    }
  })
);

// Time changed, same appointment/employee - just refresh the existing event's
// details (buildEventPayload reads the current startTime/endTime, so this
// naturally picks up the new time). No delete+recreate needed, unlike
// reassignment, since the calendar doesn't change, only the time within it.
eventEmitter.on(
  "appointment:rescheduled",
  safe("appointment:rescheduled", async ({ appointmentId }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    if (!appointment.terapeutId) return;

    const employee = await employeeService.getEmployeeByIdRaw(appointment.terapeutId);
    if (!employee?.googleCalendarId) return;

    const googleEventId = await appointmentService.getGoogleEventId(appointmentId);
    if (!googleEventId) return;

    await googleCalendarService.updateEventForAppointment(appointment, employee.googleCalendarId, googleEventId);
  })
);

// Hard delete (admin permanently removes an appointment record) - distinct from
// a status change to "cancelled"/"rejected", which the status_changed handler
// above already covers. The appointment doc is already gone by the time this
// fires, so the payload itself carries employeeId/googleEventId directly
// (see appointment.service.js's deleteAppointmentById) instead of this handler
// re-fetching them the way the other handlers do.
eventEmitter.on(
  "appointment:deleted",
  safe("appointment:deleted", async ({ employeeId, googleEventId }) => {
    if (!employeeId || !googleEventId) return;

    const employee = await employeeService.getEmployeeByIdRaw(employeeId);
    if (!employee?.googleCalendarId) return;

    await googleCalendarService.deleteEventForAppointment(employee.googleCalendarId, googleEventId);
  })
);

export default eventEmitter;