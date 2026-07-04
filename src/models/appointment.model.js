import { Schema, model } from "mongoose";
import { APPOINTMENT_STATUSES } from "./appointment-status-transitions.js";

/**
 * The core booking record. `user` is always a real User document — including for
 * "guest" bookings, where a lightweight User with status "guest" is created inside
 * the same transaction as this Appointment (see services/appointment.service.js and
 * user.model.js status enum). There is deliberately no separate Customer/guest schema.
 */
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

    // snapshot of the chosen Service.packages[] entry at booking time, so later edits
    // to the service's pricing/duration don't retroactively change past appointments
    variant: {
      servicePackageId: { type: Schema.Types.ObjectId }, // traces back to Service.packages[]._id
      name: { type: String, required: true },
      duration: { type: Number, required: true }, // minutes
      price: { type: Number, required: true },
    },

    // specific therapist, if the visitor chose one directly
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
    // computed in the pre('save') hook below from startTime + variant.duration
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

    // system-assigned therapist, used when the visitor didn't pick one and the
    // availability engine assigned the first free match at booking time
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

    // contact details as they were at booking time (phone especially — User.phone can
    // change later, and a booking made before the profile existed needs somewhere to live)
    contactSnapshot: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
    },
  },
  { timestamps: true }
);

AppointmentSchema.pre("save", function (next) {
  if (this.isModified("startTime") || this.isModified("variant.duration")) {
    if (this.startTime && this.variant?.duration) {
      this.endTime = new Date(this.startTime.getTime() + this.variant.duration * 60000);
    }
  }
  if (this.isModified("variant.price") || this.isModified("discountApplied")) {
    this.finalPrice = Math.max(0, (this.variant?.price || 0) - (this.discountApplied || 0));
  }
  next();
});

AppointmentSchema.index({ user: 1, startTime: -1 });
AppointmentSchema.index({ employee: 1, startTime: -1 });
AppointmentSchema.index({ assignedTo: 1, startTime: -1 });
AppointmentSchema.index({ status: 1, startTime: 1 });
AppointmentSchema.index({ service: 1 });

export default model("Appointment", AppointmentSchema);
