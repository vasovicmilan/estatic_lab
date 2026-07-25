import { Schema } from "mongoose";

/**
 * One content block in a blog post's body. Posts are stored as an ordered array of blocks
 * rather than one opaque HTML blob, so the admin editor can offer block-specific controls
 * (e.g. an image block needs alt text, a quote block needs an attribution) and so the SEO
 * builder can pull structured data (e.g. first image for og:image) without HTML parsing.
 */
export const BLOG_BLOCK_TYPES = ["paragraph", "heading", "image", "quote", "list", "video", "table", "cards"];

// One row of a `table` block - same shape as ComparisonRowSchema (see
// comparison-row.schema.js), reused here rather than imported since blog blocks are
// a subdocument array, not a top-level collection, and don't need the parent-level
// column-count validation hook Service's version has.
const TableRowSchema = new Schema(
  {
    label: { type: String, trim: true },
    values: { type: [String], default: [] },
  },
  { _id: false }
);

// One card in a `cards` block - same shape as ServiceFeatureSchema (icon/title/text),
// simplified for blog use (no slug/order/isActive - a blog post's cards are just
// display content, not a separately-manageable catalog).
const ContentCardSchema = new Schema(
  {
    icon: { type: String, trim: true }, // e.g. "bi bi-heart-pulse"
    title: { type: String, trim: true },
    text: { type: String, trim: true },
  },
  { _id: true }
);

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

    // used by: table
    table: {
      columns: { type: [String], default: undefined },
      rows: { type: [TableRowSchema], default: undefined },
    },

    // used by: cards
    cards: {
      type: [ContentCardSchema],
      default: undefined,
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