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

    // separate from isActive: isActive controls whether the tag shows up as a
    // filter chip / select option at all (see tag.service.js's getPublicTags),
    // isIndexable controls only whether that tag's own archive page is indexable.
    // Needed because a tag can be a perfectly useful label on a single post/product
    // while its archive page (showing just that one item) is thin, near-duplicate
    // content not worth indexing - deactivating the tag entirely would be too blunt.
    isIndexable: {
      type: Boolean,
      default: true,
      index: true,
    },

    // optional unique meta description for this tag's archive page. When empty,
    // tag.builder.js falls back to a generic templated description - set this for
    // tags with enough items to make a real archive page worth indexing well.
    description: {
      type: String,
      trim: true,
      maxlength: 160,
    },
  },
  { timestamps: true }
);

TagSchema.index({ slug: 1, domain: 1 }, { unique: true });

export default model("Tag", TagSchema);