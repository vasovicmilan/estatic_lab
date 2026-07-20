import { Schema, model } from "mongoose";

const PayoutRequestSchema = new Schema(
  {
    earnerType: {
      type: String,
      enum: ["employee", "partner"],
      required: true,
      index: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    partner: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // requested: created either by the earner asking for a payout, or by admin
    //   directly recording a payout they're about to make
    // approved: admin has signed off, money hasn't moved yet
    // paid: the real-life payment happened, this is now excluded from balance
    // rejected: admin declined the request - excluded from balance, nothing paid
    status: {
      type: String,
      enum: ["requested", "approved", "paid", "rejected"],
      default: "requested",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    adminNote: { type: String, trim: true },
  },
  { timestamps: true }
);

PayoutRequestSchema.index({ employee: 1, status: 1 });
PayoutRequestSchema.index({ partner: 1, status: 1 });

export default model("PayoutRequest", PayoutRequestSchema);