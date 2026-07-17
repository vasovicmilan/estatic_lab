import { Schema, model } from "mongoose";

const CouponUsageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // exactly one of these three is set per redemption - a coupon discounts a
    // single booking, a package purchase, or an order, never more than one, but the
    // same Coupon document/discount logic covers any of them
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    packagePurchase: {
      type: Schema.Types.ObjectId,
      ref: "PackagePurchase",
      default: null,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
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
    applicablePackages: [{ type: Schema.Types.ObjectId, ref: "Package" }],
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],

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
CouponSchema.index({ "usageHistory.packagePurchase": 1 });
CouponSchema.index({ "usageHistory.order": 1 });

export default model("Coupon", CouponSchema);