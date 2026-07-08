import { Schema, model } from "mongoose";

const PackagePurchaseItemSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    sessionsTotal: { type: Number, required: true, min: 1 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PackagePurchaseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: "Package", required: true },
    items: { type: [PackagePurchaseItemSchema], required: true },

    originalPrice: { type: Number, required: true, min: 0 },
    discountApplied: { type: Number, default: 0, min: 0 },
    pricePaid: { type: Number, required: true, min: 0 },

    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },

    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },

    purchasedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: ["active", "completed", "expired", "cancelled"],
      default: "active",
      index: true,
    },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

PackagePurchaseSchema.index({ user: 1, status: 1 });
PackagePurchaseSchema.index({ "items.service": 1 });

export default model("PackagePurchase", PackagePurchaseSchema);