import { Schema } from "mongoose";

export const BLOG_BLOCK_TYPES = ["paragraph", "heading", "image", "quote", "list", "video"];

const ContentBlogSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: BLOG_BLOCK_TYPES,
    },

    text: {
      type: String,
      trim: true,
    },

    level: {
      type: Number,
      min: 2,
      max: 4,
    },

    image: {
      img: { type: String, trim: true },
      imgDesc: { type: String, trim: true },
    },

    video: {
      url: { type: String, trim: true },
      title: { type: String, trim: true },
    },

    items: {
      type: [String],
      default: undefined,
    },
    ordered: {
      type: Boolean,
      default: false,
    },

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