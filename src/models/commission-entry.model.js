import { Schema, model } from "mongoose";

const CommissionEntrySchema = new Schema(
  {
    earnerType: {
      type: String,
      enum: ["employee", "partner"],
      required: true,
      index: true,
    },
    // exactly one of these two is set, matching earnerType - the same
    // one-of-several-refs pattern already used for CouponUsageSchema's
    // appointment/packagePurchase/order targets
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    partner: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },

    sourceType: {
      type: String,
      enum: ["appointment", "order", "package_purchase"],
      required: true,
    },
    // exactly one of these three is set, matching sourceType
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    packagePurchase: {
      type: Schema.Types.ObjectId,
      ref: "PackagePurchase",
      default: null,
    },

    // the value the commission was calculated against - the discounted price for
    // a partner-referred sale, the service/order value for an employee's own cut
    baseValue: {
      type: Number,
      required: true,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "earned", "reversed"],
      default: "pending",
      index: true,
    },
    earnedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, trim: true },
  },
  { timestamps: true }
);

CommissionEntrySchema.index({ employee: 1, status: 1 });
CommissionEntrySchema.index({ partner: 1, status: 1 });

export default model("CommissionEntry", CommissionEntrySchema);