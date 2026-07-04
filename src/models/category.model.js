import { Schema, model } from "mongoose";

/**
 * One Category model serves both the blog and the service catalogue, scoped by `domain`.
 * This is the same "one generic thing driven by data" principle the reference project
 * applies to admin views via presenters — here applied to taxonomy so we don't maintain
 * two near-identical Category schemas.
 */
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

    featureImage: {
      img: { type: String, trim: true },
      imgDesc: { type: String, trim: true },
    },

    // SEO: whether this category's archive page should be indexed
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

// a slug only needs to be unique within its own domain — "wellness" can exist as
// both a post category and a service category without colliding
CategorySchema.index({ slug: 1, domain: 1 }, { unique: true });
CategorySchema.index({ parent: 1 });

export default model("Category", CategorySchema);
