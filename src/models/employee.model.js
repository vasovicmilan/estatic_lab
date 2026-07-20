import { Schema, model } from "mongoose";

const WorkingHoursSchema = new Schema(
  {
    day: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true,
    },
    slots: [
      {
        from: { type: String, required: true },
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

    // salary employees have no commission to track; commission employees need a
    // rate for the same commission-calculation logic partners use (see
    // commission.service.js) to know what cut to compute when their work completes
    payType: {
      type: String,
      enum: ["salary", "commission"],
      default: "salary",
    },

    commissionRate: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

EmployeeSchema.pre("validate", function () {
  if (this.payType === "commission" && (this.commissionRate === null || this.commissionRate === undefined)) {
    this.invalidate("commissionRate", "Procenat provizije je obavezan kada je zaposleni na proviziji.");
  }
});

EmployeeSchema.index({ services: 1 });

export default model("Employee", EmployeeSchema);