import { Schema, model } from "mongoose";
import CouponUsageSchema from "./schemas/coupon-usage-schema";

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

    maxUses: {
      type: Number,
      default: null,
    },

    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },

    usageHistory: {
      type: [CouponUsageSchema],
      default: [],
    },

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