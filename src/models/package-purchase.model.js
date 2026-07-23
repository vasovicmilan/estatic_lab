import { Schema, model } from "mongoose";

const PackagePurchaseItemSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    servicePackageId: { type: Schema.Types.ObjectId, required: true },
    sessionsTotal: { type: Number, required: true, min: 1 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    sessionsReserved: { type: Number, default: 0, min: 0 },
    // the a la carte price of ONE session of this service+variant, snapshotted
    // at the moment of purchase - needed so a commission-based employee who
    // performs a session consumed from this package can be paid fairly: not the
    // full a la carte price (the customer got a bulk discount, so the business
    // didn't actually collect that much for this one session), and not zero
    // (a rendered service is still real work). See commission.service.js's
    // recordAppointmentCommissions for how this gets pro-rated by the package's
    // overall discount ratio.
    unitPrice: { type: Number, required: true, min: 0 },
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
PackagePurchaseSchema.index({ "items.servicePackageId": 1 });

export default model("PackagePurchase", PackagePurchaseSchema);