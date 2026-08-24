import { describe, it } from "node:test";
import assert from "node:assert/strict";
import googleCalendarProvider from "../../../src/integrations/google-calendar/google-calendar.provider.js";
import GOOGLE_CALENDAR_CONFIG from "../../../src/integrations/google-calendar/google-calendar.config.js";
import {
  createEventForAppointment,
  updateEventForAppointment,
  deleteEventForAppointment,
} from "../../../src/services/google-calendar.service.js";

function buildAppointment(overrides = {}) {
  return {
    id: "appt1",
    korisnik: { ime: "Ana Anic", telefon: "0601234567" },
    usluga: { naziv: "Masaza" },
    termin: { pocetakRaw: new Date("2026-09-01T10:00:00.000Z"), krajRaw: new Date("2026-09-01T11:00:00.000Z") },
    napomena: null,
    ...overrides,
  };
}

function fakeCalendarClient({ insert, patch, del } = {}) {
  return {
    events: {
      insert: insert || (async () => ({ data: { id: "google-event-1" } })),
      patch: patch || (async () => ({})),
      delete: del || (async () => ({})),
    },
  };
}

describe("google-calendar.service", () => {
  describe("createEventForAppointment", () => {
    it("creates an event and returns the new googleEventId when everything is configured", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      let capturedPayload;
      const client = fakeCalendarClient({
        insert: async ({ calendarId, requestBody }) => {
          capturedPayload = { calendarId, requestBody };
          return { data: { id: "google-event-1" } };
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await createEventForAppointment(buildAppointment(), "calendar-abc");

      assert.equal(result, "google-event-1");
      assert.equal(capturedPayload.calendarId, "calendar-abc");
      assert.match(capturedPayload.requestBody.summary, /Masaza.*Ana Anic/);
      assert.equal(capturedPayload.requestBody.extendedProperties.private.appointmentId, "appt1");
    });

    it("pads the end time by the configured booking buffer, but never pads the start", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      let capturedPayload;
      const client = fakeCalendarClient({
        insert: async ({ requestBody }) => {
          capturedPayload = requestBody;
          return { data: { id: "x" } };
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const appointment = buildAppointment({
        termin: { pocetakRaw: new Date("2026-09-01T10:00:00.000Z"), krajRaw: new Date("2026-09-01T11:00:00.000Z") },
      });
      await createEventForAppointment(appointment, "calendar-abc");

      assert.equal(capturedPayload.start.dateTime, "2026-09-01T10:00:00.000Z");
      assert.equal(capturedPayload.end.dateTime, "2026-09-01T11:30:00.000Z");
    });

    it("returns null without calling the API at all when Google Calendar sync isn't enabled", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => false);
      const insertMock = t.mock.fn(async () => ({ data: { id: "x" } }));
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => fakeCalendarClient({ insert: insertMock }));

      const result = await createEventForAppointment(buildAppointment(), "calendar-abc");

      assert.equal(result, null);
      assert.equal(insertMock.mock.calls.length, 0);
    });

    it("returns null without throwing when the employee has no calendar configured", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const result = await createEventForAppointment(buildAppointment(), null);
      assert.equal(result, null);
    });

    it("REGRESSION: never throws - a Calendar API failure degrades to null, since sync is a side effect that must never block booking", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const client = fakeCalendarClient({
        insert: async () => {
          throw new Error("Google API is down");
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await createEventForAppointment(buildAppointment(), "calendar-abc");

      assert.equal(result, null);
    });

    it("returns null when the calendar client itself failed to initialize", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => null);

      const result = await createEventForAppointment(buildAppointment(), "calendar-abc");

      assert.equal(result, null);
    });
  });

  describe("updateEventForAppointment", () => {
    it("patches the existing event and returns true on success", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      let captured;
      const client = fakeCalendarClient({
        patch: async ({ calendarId, eventId, requestBody }) => {
          captured = { calendarId, eventId, requestBody };
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await updateEventForAppointment(buildAppointment(), "calendar-abc", "google-event-1");

      assert.equal(result, true);
      assert.equal(captured.calendarId, "calendar-abc");
      assert.equal(captured.eventId, "google-event-1");
    });

    it("returns false without throwing when the underlying event was deleted by hand (404/410-style failure)", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const client = fakeCalendarClient({
        patch: async () => {
          const err = new Error("Not Found");
          err.code = 404;
          throw err;
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await updateEventForAppointment(buildAppointment(), "calendar-abc", "stale-event-id");

      assert.equal(result, false);
    });

    it("returns false without calling the API when there's no googleEventId to update", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const patchMock = t.mock.fn(async () => ({}));
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => fakeCalendarClient({ patch: patchMock }));

      const result = await updateEventForAppointment(buildAppointment(), "calendar-abc", null);

      assert.equal(result, false);
      assert.equal(patchMock.mock.calls.length, 0);
    });
  });

  describe("deleteEventForAppointment", () => {
    it("deletes the event and returns true on success", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      let captured;
      const client = fakeCalendarClient({
        del: async ({ calendarId, eventId }) => {
          captured = { calendarId, eventId };
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await deleteEventForAppointment("calendar-abc", "google-event-1");

      assert.equal(result, true);
      assert.deepEqual(captured, { calendarId: "calendar-abc", eventId: "google-event-1" });
    });

    it("treats an already-gone event (404/410) as a success, not a failure", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const client = fakeCalendarClient({
        del: async () => {
          const err = new Error("Gone");
          err.code = 410;
          throw err;
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await deleteEventForAppointment("calendar-abc", "already-deleted");

      assert.equal(result, true);
    });

    it("returns false for a genuine, non-404/410 failure", async (t) => {
      t.mock.method(GOOGLE_CALENDAR_CONFIG, "isEnabled", () => true);
      const client = fakeCalendarClient({
        del: async () => {
          throw new Error("Rate limited");
        },
      });
      t.mock.method(googleCalendarProvider, "getGoogleCalendarClient", () => client);

      const result = await deleteEventForAppointment("calendar-abc", "event-1");

      assert.equal(result, false);
    });
  });
});
