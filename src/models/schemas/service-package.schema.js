import { Schema } from "mongoose";

/**
 * A bookable variant of a Service — e.g. "60 min classic massage" vs "90 min classic massage",
 * or "single session" vs "package of 5". This is what the visitor actually picks when booking,
 * and what gets snapshotted onto Appointment.variant at booking time (see appointment.model.js).
 *
 * Not to be confused with the top-level `Package` model, which *combines* multiple Services —
 * this schema only ever describes variants of a single Service.
 */
const ServicePackageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // number of sessions this variant covers (1 for a single treatment, >1 for a session bundle)
    sessions: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // duration of a single session, in minutes — drives the availability engine
    duration: {
      type: Number,
      required: true,
      min: 5,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // optional, for showing a struck-through "was" price when totalPrice is discounted
    basePrice: {
      type: Number,
      min: 0,
    },

    badge: {
      type: String, // e.g. "NAJPOPULARNIJE"
      trim: true,
    },
    isBest: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { _id: true }
);

export default ServicePackageSchema;
