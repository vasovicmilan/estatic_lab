import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";

export const CATEGORY_DOMAINS = ["post", "service"];

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    domain: {
      type: String,
      required: true,
      enum: CATEGORY_DOMAINS,
      index: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    shortDescription: {
      type: String,
      trim: true,
    },
    longDescription: {
      type: String,
    },

    featureImage: ImageSchema,

    isIndexable: {
      type: Boolean,
      default: true,
      index: true,
    },

    meta: {
      priority: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true, index: true },
    },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1, domain: 1 }, { unique: true });
CategorySchema.index({ parent: 1 });

export default model("Category", CategorySchema);