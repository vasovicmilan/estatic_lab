import { Schema, model } from "mongoose";
import { CATEGORY_DOMAINS } from "./category.model.js";

/**
 * Tags mirror Category's domain-scoping but stay flat and lightweight - no parent,
 * no long description, just a name/slug used for filtering and SEO keyword clustering.
 */
const TagSchema = new Schema(
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

TagSchema.index({ slug: 1, domain: 1 }, { unique: true });

export default model("Tag", TagSchema);
