import { Schema, model } from "mongoose";
import ContentBlogSchema from "./schemas/content.blog.schema.js";

/**
 * One Category model serves the blog, the service catalogue, and (now) the product
 * catalogue, scoped by `domain`. This is the same "one generic thing driven by data"
 * principle the reference project applies to admin views via presenters - here applied
 * to taxonomy so we don't maintain three near-identical Category schemas. Tag mirrors
 * this same domain scoping (see tag.model.js) by importing CATEGORY_DOMAINS directly,
 * so adding "product" here is the only change needed for both models.
 */
export const CATEGORY_DOMAINS = ["post", "service", "product"];

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

    // Rich, block-based landing-page content for the category's own archive
    // page - same schema Post/Product already use (headings, FAQ, cards,
    // productReference/serviceReference, etc). Kept separate from the plain
    // longDescription string above rather than replacing it: longDescription
    // is what SEO meta-description fallbacks read (see blog.service.js,
    // product.controller.js), and forcing every caller to strip HTML/markup
    // out of block content just to get a plain-text summary would be more
    // fragile than keeping a short plain string for that purpose. Only
    // categories worth turning into a real landing page (e.g. a brand or
    // technology hub like "HL/Skin" or "Aparati i oprema") need this - most
    // categories can stay with just shortDescription/longDescription.
    content: {
      type: [ContentBlogSchema],
      default: [],
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

// a slug only needs to be unique within its own domain - "wellness" can exist as
// both a post category and a service category without colliding
CategorySchema.index({ slug: 1, domain: 1 }, { unique: true });
CategorySchema.index({ parent: 1 });

export default model("Category", CategorySchema);