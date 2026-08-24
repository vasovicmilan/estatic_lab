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

// Per-deployment booking rules - was hardcoded in config/booking.config.js as
// plain JS constants, which meant a different client wanting e.g. a 48h
// cancellation window instead of 24h required a code change and redeploy.
// Defaults below are the exact previous hardcoded values, so an existing
// deployment's behavior doesn't change by a single minute until an admin
// actually edits this in the admin panel. Consumed through
// config/runtime-settings.cache.js's synchronous getters, not read directly -
// see that file for why (several call sites, including EJS-template-facing
// presenters, need a synchronous value and can't await a DB read per call).
const BookingPolicySchema = new Schema(
  {
    bufferMinutes: { type: Number, default: 30, min: 0 },
    slotGridMinutes: { type: Number, default: 30, min: 5 },
    userCancellationCutoffHours: { type: Number, default: 24, min: 0 },
    rescheduleCutoffHours: { type: Number, default: 24, min: 0 },
    rescheduleSameDayFloorHours: { type: Number, default: 4, min: 0 },
    rescheduleMinLeadMinutes: { type: Number, default: 30, min: 0 },
  },
  { _id: false }
);

// Kept minimal on purpose: this drives display formatting only (see
// utils/price.util.js's formatMoney). It is NOT a multi-currency system - all
// prices in the database are still plain numbers in one implicit currency per
// deployment, same as before. A client billing in EUR instead of RSD needs
// their price data entered in EUR from the start; this only controls how a
// number is shown ("100 RSD" vs "100 €" vs "$100").
const CurrencySchema = new Schema(
  {
    code: { type: String, default: "RSD", trim: true, uppercase: true },
    symbol: { type: String, default: "RSD", trim: true },
    // "after" -> "100 RSD" (most Serbian/regional conventions), "before" ->
    // "$100" (USD/GBP-style). Kept explicit rather than inferred from the
    // symbol/code, since inference would be wrong often enough to not trust.
    symbolPosition: { type: String, enum: ["before", "after"], default: "after" },
  },
  { _id: false }
);

const SiteSettingsSchema = new Schema(
  {
    hero: { type: HeroSchema, default: () => ({}) },
    bookingPolicy: { type: BookingPolicySchema, default: () => ({}) },
    currency: { type: CurrencySchema, default: () => ({}) },
    // Reserved for the "o nama" (about us) content block mentioned alongside
    // the hero image - intentionally left out of this schema until that's
    // actually built, so an empty/unused nested object isn't sitting in every
    // document in the meantime.
  },
  { timestamps: true }
);

export default model("SiteSettings", SiteSettingsSchema);