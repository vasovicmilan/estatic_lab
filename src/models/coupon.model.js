import { Schema, model } from "mongoose";

/**
 * Optional — only needed if the studio wants promo codes on treatments. Validated against
 * Appointment.finalPrice instead of a cart total (no cart concept in this project).
 *
 * Usage is tracked two ways, at two different levels of detail on purpose:
 *  - `usedCount` is a cheap running total, incremented atomically at redemption time
 *    ($inc), so checking "is this coupon exhausted" never requires scanning `usageHistory`.
 *  - `usageHistory[]` is the audit trail (who used it, on which appointment, when, how much
 *    it discounted) — this is also what `maxUsesPerUser` is enforced against, since that
 *    check needs to count entries scoped to one specific user.
 */
const CouponUsageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    minAppointmentValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // null = unlimited total uses across all users
    maxUses: {
      type: Number,
      default: null,
    },
    // null = a single user may use this coupon an unlimited number of times
    // (still bounded by maxUses overall, if that's set)
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },

    // audit trail of every redemption — see file-level comment
    usageHistory: {
      type: [CouponUsageSchema],
      default: [],
    },

    // restrict to specific services; empty = valid for any service
    applicableServices: [{ type: Schema.Types.ObjectId, ref: "Service" }],

    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, validUntil: 1 });
CouponSchema.index({ "usageHistory.user": 1 });
CouponSchema.index({ "usageHistory.appointment": 1 });

export default model("Coupon", CouponSchema);
