import { Schema } from "mongoose";

/**
 * A single "what this service does for you" feature card on a Service detail page.
 */
const ServiceFeatureSchema = new Schema(
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String, // e.g. "bi bi-heart-pulse"
      trim: true,
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

export default ServiceFeatureSchema;
