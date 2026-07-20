import { Schema, model } from "mongoose";

const PartnerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // partners are always commission-based - there's no salaried-partner concept,
    // so unlike Employee.commissionRate this is always required rather than
    // conditional on a payType
    commissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
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

export default model("Partner", PartnerSchema);