import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import ContentBlogSchema from "./schemas/content.blog.schema.js";

const BusinessPartnerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // shown on the /saradnici list card - not the full page body
    shortDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    // full showcase page body - same block editor Post/Product use (full
    // BLOG_BLOCK_TYPES, not the email-restricted CAMPAIGN_BLOCK_TYPES, since this
    // renders on the public site, not in an email client) - gallery/video blocks
    // are exactly what covers "possible image gallery, video" from the original ask.
    content: {
      type: [ContentBlogSchema],
      default: [],
    },

    coverImage: {
      type: ImageSchema,
      required: true,
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    // optional on purpose - not every partner necessarily gets a map (e.g. an
    // online-only supplier), and geo.latitude/geo.longitude only render a map at
    // all when both are present (see business-partner.mapper.js)
    geo: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },

    // the actual outbound link - carries Milan's own referral code baked in by
    // him when he enters it, e.g. https://partner-store.example/?ref=estetiklab.
    // This app doesn't generate or track the code itself; the partner's own
    // platform (Shopify, per the original ask) is what attributes the sale back.
    outboundUrl: {
      type: String,
      required: true,
      trim: true,
    },
    ctaLabel: {
      type: String,
      trim: true,
      default: "Poseti prodavnicu",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    seo: {
      title: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 160 },
      keywords: [String],
    },
  },
  { timestamps: true }
);

BusinessPartnerSchema.index({ isActive: 1, createdAt: -1 });

export default model("BusinessPartner", BusinessPartnerSchema);
