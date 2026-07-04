import { Schema, model } from "mongoose";

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

CouponSchema.index({ isActive: 1, validUntil: 1 });
CouponSchema.index({ "usageHistory.user": 1 });
CouponSchema.index({ "usageHistory.appointment": 1 });

export default model("Coupon", CouponSchema);
