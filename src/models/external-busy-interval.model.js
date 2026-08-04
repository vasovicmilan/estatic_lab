import { Schema, model } from "mongoose";

// Cached snapshot of "this employee is busy from X to Y" pulled from an external
// booking platform's ICS/iCal feed (currently just SrediMe, kept generic via
// `source` in case a second platform is added later). Populated and kept fresh by
// jobs/sredime-jobs.js on a cron schedule - never written to directly by request
// handlers, which is why there's no create/update validator pair like the other
// admin-facing models have.
//
// One document per external calendar event. `externalUid` is that event's UID
// from inside the ICS file (VEVENT's UID field) - stable across re-imports, so a
// reschedule on SrediMe's side updates the matching document instead of creating
// a duplicate, and a cancellation is detected by its UID simply no longer
// appearing in the feed (see sredime-jobs.js's cleanup step).
const ExternalBusyIntervalSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["sredime"],
      required: true,
    },

    externalUid: {
      type: String,
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    // raw VEVENT SUMMARY, kept only for admin-side debugging ("why is this slot
    // blocked?") - never shown to end customers, who only ever see the slot as
    // unavailable, never why.
    summary: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// One row per (employee, source, externalUid) - the natural key sredime-jobs.js
// upserts against on every sync run.
ExternalBusyIntervalSchema.index({ employee: 1, source: 1, externalUid: 1 }, { unique: true });

// The actual query pattern availability.service.js needs: every external busy
// interval for one employee that overlaps a given day.
ExternalBusyIntervalSchema.index({ employee: 1, startTime: 1 });

export default model("ExternalBusyInterval", ExternalBusyIntervalSchema);