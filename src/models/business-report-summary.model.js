import { Schema, model } from "mongoose";

const COUNT_SCHEMA = new Schema({ label: { type: String, required: true }, count: { type: Number, default: 0 }, value: { type: Number, default: 0 } }, { _id: false });

/**
 * One cached snapshot of business metrics for a given period. Deliberately
 * NOT built the way LogSummary is (daily documents aggregated bottom-up into
 * weekly/monthly/yearly) - log analysis reads flat files that can't be
 * queried by date range, so pre-aggregating into daily Mongo docs is the only
 * practical option there. Business metrics already live in MongoDB
 * (Appointment, Order, PackagePurchase, CommissionEntry, Coupon), so each
 * period here is computed directly from those collections for its own exact
 * date range - see business-report.service.js. This document exists purely
 * as a cache/archive (so a report doesn't have to be recomputed to browse
 * history, and so the periodic email has a stable snapshot to send), not as
 * a computation building block for other periods.
 */
const BusinessReportSummarySchema = new Schema(
  {
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      required: true,
      index: true,
    },
    // "2026-08-24" (daily) / "2026-W34" (weekly) / "2026-08" (monthly) /
    // "2026-Q3" (quarterly) / "2026" (yearly) - human-meaningful and directly
    // sortable as a string within a periodType, which is all list/lookup
    // needs (no cross-periodType sorting is ever done).
    periodKey: {
      type: String,
      required: true,
      index: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    appointments: {
      total: { type: Number, default: 0 },
      byStatus: [COUNT_SCHEMA], // label = status, count = how many
      revenue: { type: Number, default: 0 }, // sum of finalPrice for completed appointments
      byService: [COUNT_SCHEMA], // label = service name, count = appointments, value = revenue
      byEmployee: [COUNT_SCHEMA], // label = employee name, count = completed appointments, value = revenue
      noShowRate: { type: Number, default: 0 }, // percentage, 0-100
    },

    orders: {
      total: { type: Number, default: 0 },
      byStatus: [COUNT_SCHEMA],
      revenue: { type: Number, default: 0 }, // sum of totalPrice for completed orders
      avgOrderValue: { type: Number, default: 0 },
      byProduct: [COUNT_SCHEMA], // top products by units sold, value = revenue
    },

    packages: {
      totalPurchased: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 }, // sum of pricePaid
    },

    commissions: {
      employeeEarned: { type: Number, default: 0 },
      employeePaid: { type: Number, default: 0 },
      partnerEarned: { type: Number, default: 0 },
      partnerPaid: { type: Number, default: 0 },
    },

    coupons: {
      totalRedemptions: { type: Number, default: 0 },
      totalDiscountGiven: { type: Number, default: 0 },
      byCoupon: [COUNT_SCHEMA], // label = code, count = redemptions, value = discount given
    },

    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// one document per (periodType, periodKey) - re-generating a period overwrites
// its own prior snapshot rather than accumulating duplicates
BusinessReportSummarySchema.index({ periodType: 1, periodKey: 1 }, { unique: true });

export default model("BusinessReportSummary", BusinessReportSummarySchema);
