import { Schema, model } from "mongoose";

/**
 * One weekday's working-hour slots for an Employee. `slots` is an array (not a single
 * from/to) so a therapist can have a split shift (e.g. 09:00-13:00 and 16:00-20:00).
 * This is the primary input to the availability engine (services/availability.service.js).
 */
const WorkingHoursSchema = new Schema(
  {
    day: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true,
    },
    slots: [
      {
        from: { type: String, required: true }, // "HH:MM", validated at the validator layer
        to: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

const EmployeeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // optional link to a public "our experts" profile — see expert.model.js file-level
    // comment. Bio/title/photo live there, not duplicated here. null until/unless this
    // staff account is also shown publicly under an Expert profile.
    expert: {
      type: Schema.Types.ObjectId,
      ref: "Expert",
      default: null,
      index: true,
    },

    services: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],

    workingHours: {
      type: [WorkingHoursSchema],
      default: [],
    },

    // whether this employee currently accepts bookings at all, independent of workingHours
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

EmployeeSchema.index({ services: 1 });
EmployeeSchema.index({ isActive: 1 });

export default model("Employee", EmployeeSchema);
