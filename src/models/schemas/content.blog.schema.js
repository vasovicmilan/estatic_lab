import { Schema } from "mongoose";

/**
 * One content block in a blog post's body. Posts are stored as an ordered array of blocks
 * rather than one opaque HTML blob, so the admin editor can offer block-specific controls
 * (e.g. an image block needs alt text, a quote block needs an attribution) and so the SEO
 * builder can pull structured data (e.g. first image for og:image) without HTML parsing.
 */
export const BLOG_BLOCK_TYPES = ["paragraph", "heading", "image", "quote", "list", "video"];

const ContentBlogSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: BLOG_BLOCK_TYPES,
    },

    // used by: paragraph, heading, quote
    text: {
      type: String,
      trim: true,
    },

    // used by: heading (2-4), quote (cite as `text`, source as `meta`)
    level: {
      type: Number,
      min: 2,
      max: 4,
    },

    // used by: image
    image: {
      img: { type: String, trim: true },
      imgDesc: { type: String, trim: true },
    },

    // used by: video
    video: {
      url: { type: String, trim: true },
      title: { type: String, trim: true },
    },

    // used by: list
    items: {
      type: [String],
      default: undefined,
    },
    ordered: {
      type: Boolean,
      default: false,
    },

    // used by: quote (attribution)
    meta: {
      type: String,
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

export default ContentBlogSchema;
