import { Schema, model } from "mongoose";

const CountEntrySchema = new Schema(
  {
    label: { type: String, required: true },
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