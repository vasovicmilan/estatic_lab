import googleCalendarProvider from "../integrations/google-calendar/google-calendar.provider.js";
import GOOGLE_CALENDAR_CONFIG from "../integrations/google-calendar/google-calendar.config.js";
import { getBookingPolicy } from "../config/runtime-settings.cache.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { BUSINESS } from "../config/business.config.js";

const BASE_URL = BUSINESS.siteUrl;
// Computed fresh on every call, not once at module load - booking policy is
// admin-editable now (see runtime-settings.cache.js), so a frozen constant
// here would mean a policy change only took effect after a server restart.
function bufferMs() {
  return getBookingPolicy().bufferMinutes * 60000;
}

// Every event this app pushes carries this marker in extendedProperties. This is
// what will let the future SrediMe-facing sync (or any future poller reading this
// same calendar) tell "an appointment WE wrote" apart from "an event that showed
// up from somewhere else" - without it, a future reconciliation job could easily
// mistake our own pushed events for new external bookings and double-count them.
const SOURCE_TAG = "estetik-lab";

function buildEventPayload(appointment) {
  const clientName = appointment.korisnik?.ime || "Klijent";
  const serviceName = appointment.usluga?.naziv || "Termin";

  // End padded by BOOKING_BUFFER_MINUTES so the calendar itself reflects
  // cleanup/prep time after the appointment, without relying on SrediMe (or
  // anyone else reading this calendar) to independently apply the same buffer.
  // Deliberately NOT padded before the start - Milan wants that on the calendar
  // as fully bookable, unlike the "after" side.
  const start = new Date(appointment.termin.pocetakRaw);
  const paddedEnd = new Date(new Date(appointment.termin.krajRaw).getTime() + bufferMs());

  return {
    summary: `${serviceName} - ${clientName}`,
    description: [
      `Klijent: ${clientName}`,
      appointment.korisnik?.telefon ? `Telefon: ${appointment.korisnik.telefon}` : null,
      appointment.napomena ? `Napomena: ${appointment.napomena}` : null,
      `Detalji: ${BASE_URL}/admin/termini/detalji/${appointment.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: paddedEnd.toISOString() },
    extendedProperties: {
      private: {
        source: SOURCE_TAG,
        appointmentId: appointment.id,
      },
    },
  };
}

// Returns the new googleEventId on success, or null on any failure/skip -
// calendar sync is a side effect of booking, never allowed to block or fail the
// booking itself, so every path here degrades to "null, logged" rather than throwing.
export async function createEventForAppointment(appointment, googleCalendarId) {
  try {
    if (!GOOGLE_CALENDAR_CONFIG.isEnabled() || !googleCalendarId) return null;

    const calendar = googleCalendarProvider.getGoogleCalendarClient();
    if (!calendar) {
      logError("Google Calendar client not initialized", null, { appointmentId: appointment.id });
      return null;
    }

    const response = await calendar.events.insert({
      calendarId: googleCalendarId,
      requestBody: buildEventPayload(appointment),
    });

    logInfo("Google Calendar event created", { appointmentId: appointment.id, googleEventId: response.data.id });
    return response.data.id;
  } catch (error) {
    logError("Failed to create Google Calendar event", error, { appointmentId: appointment.id, googleCalendarId });
    return null;
  }
}

// Used for reschedules (time changed) and reassignments to the SAME employee -
// for a reassignment to a DIFFERENT employee, delete + create is used instead
// (see the listener), since an event can't move between calendars via update.
export async function updateEventForAppointment(appointment, googleCalendarId, googleEventId) {
  try {
    if (!GOOGLE_CALENDAR_CONFIG.isEnabled() || !googleCalendarId || !googleEventId) return false;

    const calendar = googleCalendarProvider.getGoogleCalendarClient();
    if (!calendar) return false;

    await calendar.events.patch({
      calendarId: googleCalendarId,
      eventId: googleEventId,
      requestBody: buildEventPayload(appointment),
    });

    logInfo("Google Calendar event updated", { appointmentId: appointment.id, googleEventId });
    return true;
  } catch (error) {
    // A 404/410 here almost always means the event was deleted by hand directly
    // in Google Calendar (not through the app) - not worth surfacing as a hard
    // failure, since the appointment itself is still perfectly valid either way.
    logError("Failed to update Google Calendar event", error, { appointmentId: appointment.id, googleEventId });
    return false;
  }
}

export async function deleteEventForAppointment(googleCalendarId, googleEventId) {
  try {
    if (!GOOGLE_CALENDAR_CONFIG.isEnabled() || !googleCalendarId || !googleEventId) return false;

    const calendar = googleCalendarProvider.getGoogleCalendarClient();
    if (!calendar) return false;

    await calendar.events.delete({ calendarId: googleCalendarId, eventId: googleEventId });
    logInfo("Google Calendar event deleted", { googleEventId });
    return true;
  } catch (error) {
    // Same reasoning as the 404 case in updateEventForAppointment - already gone
    // is a success from this function's point of view, not a failure to log loudly.
    if (error?.code === 404 || error?.code === 410) return true;
    logError("Failed to delete Google Calendar event", error, { googleEventId });
    return false;
  }
}

export default { createEventForAppointment, updateEventForAppointment, deleteEventForAppointment };