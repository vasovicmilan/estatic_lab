import { Schema, model } from "mongoose";

const CountEntrySchema = new Schema(
  {
    label: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false }
);

const RouteTimingSchema = new Schema(
  {
    label: { type: String, required: true },
    avgMs: { type: Number, required: true },
    count: { type: Number, required: true },
  },
  { _id: false }
);

const LogSummarySchema = new Schema(
  {
    // "YYYY-MM-DD" - the calendar day this summary covers, in server-local reporting
    // terms (see log-analysis.util.js for how lines get bucketed into a day)
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    requests: {
      total: { type: Number, default: 0 },
      byStatusClass: {
        "2xx": { type: Number, default: 0 },
        "3xx": { type: Number, default: 0 },
        "4xx": { type: Number, default: 0 },
        "5xx": { type: Number, default: 0 },
      },
      uniqueIPs: { type: Number, default: 0 },
    },

    logs: {
      infoCount: { type: Number, default: 0 },
      warnCount: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
    },

    // avgResponseTimeMs/maxResponseTimeMs are the display-ready values for this one
    // day; totalResponseTimeMs+responseTimeSampleCount are stored alongside them
    // specifically so a multi-day report (see log-report.service.js's
    // aggregateRange) can recompute a correctly-weighted average across days,
    // rather than incorrectly averaging several daily averages together
    perf: {
      avgResponseTimeMs: { type: Number, default: 0 },
      maxResponseTimeMs: { type: Number, default: 0 },
      maxResponseTimeUrl: { type: String, default: null },
      totalResponseTimeMs: { type: Number, default: 0 },
      responseTimeSampleCount: { type: Number, default: 0 },
      slowestRoutes: [RouteTimingSchema],
    },

    // top N by count, not exhaustive - enough for a report to point at, not a full dump
    topErrors: [CountEntrySchema],
    topUrls: [CountEntrySchema],
    topErrorUrls: [CountEntrySchema], // 4xx/5xx responses only, most-hit first

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default model("LogSummary", LogSummarySchema);