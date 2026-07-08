import { Schema, model } from "mongoose";
import { APPOINTMENT_STATUSES } from "./appointment-status-transitions.js";

const AppointmentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    variant: {
      servicePackageId: { type: Schema.Types.ObjectId }, // traces back to Service.packages[]._id
      name: { type: String, required: true },
      duration: { type: Number, required: true }, // minutes
      price: { type: Number, required: true },
    },

    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
      default: null,
    },

    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "pending",
      index: true,
    },

    rejectedBy: { type: String, enum: ["system", "admin", "employee"] },
    rejectedAt: Date,
    rejectionReason: { type: String, trim: true },

    confirmedBy: { type: String, enum: ["system", "admin", "employee"] },
    confirmedAt: Date,

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
      default: null,
    },
    assignedBy: { type: String, enum: ["system", "admin"] },
    assignedAt: Date,

    cancelledBy: { type: String, enum: ["user", "admin"] },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true },

    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    // mutually exclusive with coupon in practice (a booking either pays in full,
    // minus a coupon, OR is covered by a package — not both), but that's a business
    // rule the service layer enforces, not something encoded at the schema level
    packagePurchase: {
      type: Schema.Types.ObjectId,
      ref: "PackagePurchase",
      default: null,
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
    },

    contactSnapshot: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
    },
  },
  { timestamps: true }
);

AppointmentSchema.pre("save", function () {
  if (this.isModified("startTime") || this.isModified("variant.duration")) {
    if (this.startTime && this.variant?.duration) {
      this.endTime = new Date(this.startTime.getTime() + this.variant.duration * 60000);
    }
  }
  if (this.isModified("variant.price") || this.isModified("discountApplied") || this.isModified("packagePurchase")) {
    this.finalPrice = this.packagePurchase ? 0 : Math.max(0, (this.variant?.price || 0) - (this.discountApplied || 0));
  }
});

AppointmentSchema.index({ user: 1, startTime: -1 });
AppointmentSchema.index({ employee: 1, startTime: -1 });
AppointmentSchema.index({ assignedTo: 1, startTime: -1 });
AppointmentSchema.index({ status: 1, startTime: 1 });

export default model("Appointment", AppointmentSchema);