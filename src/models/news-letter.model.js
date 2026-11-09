import { Schema, model } from "mongoose";

// Single source of truth for newsletter segments - imported by campaign.model.js's
// targetInterests too, so a campaign can only ever target a segment a subscriber
// could actually be in.
export const NEWSLETTER_INTERESTS = ["general", "products", "partnership"];

// Where the address came from (which part of the system). "unknown" = signed up before this
// field existed. Set once, on the first opt-in - see news-letter.service.js's subscribe().
export const NEWSLETTER_SOURCES = ["footer", "tocak", "api", "admin", "unknown"];

const NewsLetterSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    status: {
      type: String,
      enum: ["subscribed", "unsubscribed"],
      default: "subscribed",
      index: true,
    },

    // What kind of mail this subscriber wants - "general" (studio news/promos),
    // "products" (retail/equipment-focused), "partnership" (partner showcase/
    // affiliate-oriented content). Defaults to ["general"] so a subscriber who
    // didn't touch the interest checkboxes still gets the baseline campaigns,
    // and so a campaign.service.js send with an empty targetInterests (meaning
    // "everyone") reaches every subscribed address regardless of what's in here.
    interests: {
      type: [String],
      enum: NEWSLETTER_INTERESTS,
      default: ["general"],
    },

    source: {
      type: String,
      enum: NEWSLETTER_SOURCES,
      default: "unknown",
      index: true,
    },
    // Finer detail for `source`: the page path the footer form was submitted from
    // (e.g. "/usluge/neo-sculpt-pro"), or the campaign tag of the wheel QR (?src=sajam-2026).
    sourceDetail: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },

    unsubscribeToken: {
      type: String,
      required: true,
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    // Proof-of-consent timestamp, distinct from subscribedAt: subscribedAt updates
    // on every re-subscribe (see news-letter.service.js's subscribe()), but
    // consentedAt is set once, the first time this address ever opted in, and is
    // never overwritten - the durable record of "when did this person first
    // agree" that a data-protection inquiry would ask for.
    consentedAt: {
      type: Date,
      default: null,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default model("NewsLetter", NewsLetterSchema);
