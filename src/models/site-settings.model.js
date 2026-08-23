import { Schema, model } from "mongoose";

// Singleton document - exactly one SiteSettings ever exists (see
// site-settings.repository.js's findOrCreateSiteSettings, the only way this
// model is ever read). Modeled as its own collection rather than adding
// fields to business.config.js on purpose: business.config.js is static,
// code-deployed, single-source-of-truth business identity (name, address,
// hours...) - this is admin-editable, per-deployment CONTENT that changes
// without a deploy. Keeping them separate means a future white-label client
// (see the trade-show/commercialization docs) gets their own hero/content
// without touching code at all.
const HeroSchema = new Schema(
  {
    image: { type: String, default: null }, // e.g. /images/site/hero-123-medium.webp
    imageAlt: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const SiteSettingsSchema = new Schema(
  {
    hero: { type: HeroSchema, default: () => ({}) },
    // Reserved for the "o nama" (about us) content block mentioned alongside
    // the hero image - intentionally left out of this schema until that's
    // actually built, so an empty/unused nested object isn't sitting in every
    // document in the meantime.
  },
  { timestamps: true }
);

export default model("SiteSettings", SiteSettingsSchema);