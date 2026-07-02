import { Schema, model } from "mongoose";

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
      required: true,
      trim: true,
    },
    longDescription: {
      type: String,
      required: true,
    },
    featureImage: {
      img: { type: String, trim: true },
      imgDesc: { type: String },
    },
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

export default model("Category", CategorySchema);