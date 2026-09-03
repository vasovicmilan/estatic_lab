import { Schema } from "mongoose";
import ImageSchema from "./image.schema.js";
import VideoSchema from "./video.schema.js";
import FAQSchema from "./faq.schema.js";
import ComparisonRowSchema from "./comparison-row.schema.js";

/**
 * One content block in a blog post's body. Posts are stored as an ordered array of blocks
 * rather than one opaque HTML blob, so the admin editor can offer block-specific controls
 * (e.g. an image block needs alt text, a quote block needs an attribution) and so the SEO
 * builder can pull structured data (e.g. first image for og:image) without HTML parsing.
 *
 * image/gallery/video/faq/table all reuse the same shared schemas as Service, Package,
 * Product, etc. (ImageSchema, VideoSchema, FAQSchema, ComparisonRowSchema) rather than
 * redefining near-duplicates here - one place to change if e.g. ImageSchema ever adds a
 * field, and it keeps a blog post's FAQ block identical in shape to Service's own FAQ list.
 */
export const BLOG_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "gallery",
  "quote",
  "list",
  "video",
  "table",
  "cards",
  "callout",
  "faq",
  "cta",
  "divider",
  "serviceReference",
  "productReference",
];

// One card in a `cards` block. Deliberately NOT ServiceFeatureSchema (icon/title/text
// here vs icon/name/description there, plus ServiceFeatureSchema's slug/isActive don't
// apply to display-only blog content) - reusing it would mean either renaming fields
// throughout the mapper/templates/admin widget to match, or carrying unused slug/isActive
// baggage into every blog card. Kept as its own small schema instead.
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

    // used by: image - reused ImageSchema (img/imgDesc, both required - alt text
    // isn't optional here any more than it is on a Product/Service image)
    image: ImageSchema,

    // used by: gallery - same ImageSchema, repeated
    gallery: {
      type: [ImageSchema],
      default: undefined,
    },

    // used by: video - reused VideoSchema (adds thumbnail + isExternal on top of
    // the url/title this block already needed)
    video: VideoSchema,

    // used by: list
    items: {
      type: [String],
      default: undefined,
    },
    ordered: {
      type: Boolean,
      default: false,
    },

    // used by: table - rows reuse ComparisonRowSchema (same label/values shape
    // Service's comparison table uses; the parent-level column-count validation
    // hook lives on Service specifically and doesn't apply here, which is fine -
    // this subschema alone doesn't carry that hook)
    table: {
      columns: { type: [String], default: undefined },
      rows: { type: [ComparisonRowSchema], default: undefined },
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

    // used by: callout (section heading), faq (section heading), cta (headline),
    // serviceReference (headline) - one shared field rather than 4 near-duplicates
    title: {
      type: String,
      trim: true,
    },

    // used by: callout only - which Bootstrap alert style to render as
    variant: {
      type: String,
      enum: ["info", "success", "warning", "danger"],
      default: "info",
    },

    // used by: faq - reused FAQSchema (same question/answer/order shape already
    // embedded on Service/Package)
    faqItems: {
      type: [FAQSchema],
      default: undefined,
    },

    // used by: cta, serviceReference, productReference - the link target + button
    // label. Same shape for all three: cta is a standalone "book now" prompt,
    // serviceReference/productReference are "see also" links into a specific
    // Service/Product page - visually distinct in the templates but structurally
    // identical, so one sub-schema covers all of them.
    button: {
      text: { type: String, trim: true },
      url: { type: String, trim: true },
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

export default ContentBlogSchema;