import { Schema } from "mongoose";

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
    sessions: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    basePrice: {
      type: Number,
    },
    badge: {
      type: String,
    },
    isBest: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      required: true,
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