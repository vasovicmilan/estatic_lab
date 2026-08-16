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
    // conditional on a payType.
    //
    // Split into two independent rates rather than one flat rate across
    // everything a partner refers: services/packages (typically lower-ticket,
    // percentage makes sense) and shop products (catalog spans small consumables
    // to devices worth thousands of euros - a rate that's fair on a service is
    // often far too generous on an expensive device). See commission.service.js
    // for where each is applied.
    commissionRateServices: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    commissionRateProducts: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Absolute ceiling on a single commission entry, independent of the rate -
    // a last line of defense so a high-value transaction (a several-thousand-euro
    // device order, in particular) can't generate a runaway payout even if the
    // rate itself was set without that specific transaction in mind. null = no
    // ceiling, same "unlimited" convention as Coupon.maxUses.
    maxCommissionAmountServices: {
      type: Number,
      default: null,
      min: 0,
    },
    maxCommissionAmountProducts: {
      type: Number,
      default: null,
      min: 0,
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