import { Schema, model } from "mongoose";
import OrderItemSchema from "./schemas/order-item.schema.js";
import PhoneSchema from "./schemas/phone.schema.js";
import AddressSchema from "./schemas/address.schema.js";
import { ORDER_STATUSES } from "./order-status-transitions.js";

const OrderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // frozen at order-confirmation time, same reasoning as Appointment.contactSnapshot -
    // the user's profile can change later, but the order should always show what it
    // actually was at checkout. No phone here (unlike Appointment.contactSnapshot) -
    // the `phone` field below is already properly encrypted; duplicating it here in
    // plaintext would defeat that.
    contactSnapshot: {
      firstName: String,
      lastName: String,
      email: String,
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
    shipping: { type: Number, min: 0, default: 0 },

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
    totalPrice: {
      type: Number,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      required: true,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },

    // lets a guest look up/cancel their own order from the confirmation email without
    // needing to log in - same idea as the appointment cancellation link pattern
    cancelToken: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },

    processingAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    completedAt: Date,

    cancelledBy: { type: String, enum: ["user", "admin"] },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true },

    returnedAt: Date,
    returnReason: { type: String, trim: true },
    refundedAt: Date,
  },
  { timestamps: true }
);

OrderSchema.pre("save", function () {
  if (this.isModified("subtotal") || this.isModified("shipping") || this.isModified("discountApplied")) {
    this.totalPrice = Math.max(0, (this.subtotal || 0) + (this.shipping || 0) - (this.discountApplied || 0));
  }
});

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "contactSnapshot.email": 1 });
OrderSchema.index({ "phone.hash": 1 });
OrderSchema.index({ "address.hash": 1 });

export default model("Order", OrderSchema);