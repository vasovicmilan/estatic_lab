import { Schema, model } from "mongoose";
import OrderItemSchema from "./schemas/order-item.schema.js";
import PhoneSchema from "./schemas/phone.schema.js";
import AddressSchema from "./schemas/address.schema.js";

const TemporaryOrderSchema = new Schema(
  {
    // resolved (found-or-created, same as bookAppointment's guest-account flow)
    // at temporary-order creation time, not deferred to confirmation - see the
    // accompanying design note on why this is an intentional simplification
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    contactSnapshot: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },

    phone: {
      type: PhoneSchema,
      required: true,
    },
    address: {
      type: AddressSchema,
      required: true,
    },

    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Porudžbina mora sadržati bar jednu stavku.",
      },
    },

    subtotal: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },

    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPrice: { type: Number, required: true, min: 0, default: 0 },

    note: {
      type: String,
      trim: true,
    },

    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenExpiration: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

TemporaryOrderSchema.pre("save", function () {
  if (this.isModified("subtotal") || this.isModified("shipping") || this.isModified("discountApplied")) {
    this.totalPrice = Math.max(0, (this.subtotal || 0) + (this.shipping || 0) - (this.discountApplied || 0));
  }
});

TemporaryOrderSchema.index({ "contactSnapshot.email": 1, createdAt: -1 });
TemporaryOrderSchema.index({ "items.product": 1 });
TemporaryOrderSchema.index({ tokenExpiration: 1 });

export default model("TemporaryOrder", TemporaryOrderSchema);