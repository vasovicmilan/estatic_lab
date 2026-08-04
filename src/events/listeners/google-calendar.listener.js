import eventEmitter from "../event.emitter.js";
import * as googleCalendarService from "../../services/google-calendar.service.js";
import * as appointmentService from "../../services/appointment.service.js";
import * as employeeService from "../../services/employee.service.js";
import { logError } from "../../utils/logger.util.js";

function safe(eventName, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      logError(`[google-calendar listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

const FREED_STATUSES = ["cancelled", "rejected"];
const ACTIVE_STATUSES = ["pending", "confirmed"];

eventEmitter.on(
  "appointment:created",
  safe("appointment:created", async ({ appointmentId }) => {
    const appointment = await appointmentService.getAppointmentById(appointmentId, null, "admin");
    if (!appointment.terapeutId) return;

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

    if (googleEventId && previousEmployee?.googleCalendarId) {
      await googleCalendarService.deleteEventForAppointment(previousEmployee.googleCalendarId, googleEventId);
      await appointmentService.setGoogleEventId(appointmentId, null);
    }

    if (newEmployee?.googleCalendarId) {
      const newGoogleEventId = await googleCalendarService.createEventForAppointment(appointment, newEmployee.googleCalendarId);
      if (newGoogleEventId) await appointmentService.setGoogleEventId(appointmentId, newGoogleEventId);
    }
  })
);

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