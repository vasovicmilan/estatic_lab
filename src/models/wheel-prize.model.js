import { Schema, model } from "mongoose";

// One slice of the prize wheel (/tocak). `weight` is its relative chance, `stock` the
// total number that can be handed out (null = unlimited), `awardedCount` how many were.
// Each win mints its own single-use Coupon from the coupon* template below - see
// wheel.service.js's spin(). Exactly one prize should have isFallback = true: an
// unlimited prize the wheel falls back to whenever the drawn one has just run out.
const WheelPrizeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    shortLabel: { type: String, required: true, trim: true, maxlength: 18 },
    color: { type: String, default: "#b08d57" },

    weight: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: null, min: 0 },
    awardedCount: { type: Number, default: 0, min: 0 },
    isFallback: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },

    // coupon template
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    // empty = valid for every service; otherwise only these (resolved by slug when the coupon is minted)
    serviceSlugs: { type: [String], default: [] },
    // true = the coupon also discounts shop products (apparatus categories always excluded)
    includeProducts: { type: Boolean, default: false },
    validDays: { type: Number, default: 30, min: 1 },
  },
  { timestamps: true }
);

export default model("WheelPrize", WheelPrizeSchema);
