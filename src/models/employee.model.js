import { Schema, model } from "mongoose";
import WorkingHoursSchema from "./schemas/working-hours-schema";

const EmployeeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

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