import { Schema, model } from "mongoose";
import { DAYS_OF_WEEK, TIME_STRING_RE } from "../utils/working-hours.util.js";

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

// Guarantees a commission-based employee still earns something for a
// package-covered appointment even when the package itself was sold at a
// heavy promotional discount or given away entirely (pricePaid: 0), and
// likewise for a manually-created appointment (walk-in gift, nagrada,
// poklon) whose price was hand-set by an admin/employee - the employee
// performed the same real work either way. Deliberately scoped narrow
// (package-covered OR admin-price-overridden appointments only,
// commission-paid employees only) rather than touching regular a-la-carte
// commission math at all - see commission.service.js's own comment on
// recordAppointmentCommissions for exactly where this applies and why a
// flat percentage of a heavily-discounted or free session would otherwise
// round down to little or nothing.
const CommissionPolicySchema = new Schema(
  {
    minimumSessionCommission: { type: Number, default: 500, min: 0 },
  },
  { _id: false }
);

// Salon-wide DISPLAY schedule (kontakt stranica, footer, SEO JSON-LD) - this is
// DELIBERATELY NOT the scheduling source of truth. Employee.workingHours (see
// employee.model.js's WorkingHoursSchema) keeps driving real slot generation
// (availability.service.js) exactly as before; this is a parallel, simpler,
// purely informational schedule an admin fills in for humans/crawlers to read
// ("kada smo otvoreni"), with one open/close range per day instead of several
// shift blocks - there's no booking concept here, just "otvoreno od-do" or
// "zatvoreno". Reuses the same day enum/HH:mm convention as
// Employee.workingHours (see working-hours.util.js) so both schedules speak
// the same "day"/time-string language even though they serve different ends.
const WorkingHoursDaySchema = new Schema(
  {
    day: { type: String, enum: DAYS_OF_WEEK, required: true },
    // false = salon is fully closed that day (e.g. nedelja) - `from`/`to` are
    // then ignored for display (see presenters/EJS) but kept populated with
    // their defaults rather than null, so re-opening a day back up doesn't
    // require re-typing a time from scratch.
    isOpen: { type: Boolean, default: false },
    from: { type: String, default: "09:00", match: [TIME_STRING_RE, "Neispravan format vremena (očekivano HH:MM)"] },
    to: { type: String, default: "20:00", match: [TIME_STRING_RE, "Neispravan format vremena (očekivano HH:MM)"] },
  },
  { _id: false }
);

// One-off closures/praznici (Nova godina, kolektivni godišnji odmor...) - a
// HARD, salon-wide override checked by availability.service.js BEFORE any
// individual employee's own working hours: a closed date means zero bookable
// slots that day for every employee, regardless of who would otherwise be on
// shift. `recurringYearly: true` matches every year on the same month/day
// (see runtime-settings.cache.js's isDateClosed) so a fixed holiday only ever
// needs to be entered once, instead of an admin re-adding "1. januar" every
// single year.
const ClosedDateSchema = new Schema(
  {
    date: { type: Date, required: true },
    reason: { type: String, default: "", trim: true, maxlength: 200 },
    recurringYearly: { type: Boolean, default: false },
  },
  { _id: false }
);

// Unconfigured-by-default (every day isOpen: false) rather than pre-filled
// with plausible hours - this is the sentinel organization.builder.js checks
// (via runtime-settings.cache.js's hasFixedWorkingHours) to tell "admin hasn't
// set a fixed schedule yet" apart from "admin explicitly wants every day
// closed", so a brand-new deployment keeps using the derived
// employeeService.getAggregateBusinessHours() JSON-LD hours it already had,
// instead of silently claiming the salon is closed 7 days a week.
function defaultWorkingHours() {
  return DAYS_OF_WEEK.map((day) => ({ day, isOpen: false, from: "09:00", to: "20:00" }));
}

const SiteSettingsSchema = new Schema(
  {
    hero: { type: HeroSchema, default: () => ({}) },
    bookingPolicy: { type: BookingPolicySchema, default: () => ({}) },
    currency: { type: CurrencySchema, default: () => ({}) },
    commissionPolicy: { type: CommissionPolicySchema, default: () => ({}) },
    workingHours: { type: [WorkingHoursDaySchema], default: defaultWorkingHours },
    closedDates: { type: [ClosedDateSchema], default: () => [] },
    // Reserved for the "o nama" (about us) content block mentioned alongside
    // the hero image - intentionally left out of this schema until that's
    // actually built, so an empty/unused nested object isn't sitting in every
    // document in the meantime.
  },
  { timestamps: true }
);

export default model("SiteSettings", SiteSettingsSchema);