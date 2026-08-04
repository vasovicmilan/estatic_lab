import { google } from "googleapis";
import GOOGLE_CALENDAR_CONFIG from "./google-calendar.config.js";
import { logInfo, logError } from "../../utils/logger.util.js";

let calendarClient = null;

// A service account authenticates itself directly with a signed JWT (no OAuth
// consent screen, no refresh token to manage, no per-employee login) - it can
// write to any calendar that has explicitly shared "Make changes to events"
// access with its client_email, which is the sharing step documented in the
// employee onboarding steps (see the Employee.googleCalendarId field).
export function initGoogleCalendarClient() {
  try {
    if (!GOOGLE_CALENDAR_CONFIG.isEnabled()) {
      logInfo("Google Calendar sync not configured - skipping");
      return null;
    }

    const auth = new google.auth.JWT({
      email: GOOGLE_CALENDAR_CONFIG.clientEmail,
      key: GOOGLE_CALENDAR_CONFIG.getPrivateKey(),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    calendarClient = google.calendar({ version: "v3", auth });
    logInfo("Google Calendar client initialized");
    return calendarClient;
  } catch (error) {
    logError("Failed to initialize Google Calendar client", error);
    return null;
  }
}

export function getGoogleCalendarClient() {
  return calendarClient;
}

export default { initGoogleCalendarClient, getGoogleCalendarClient };