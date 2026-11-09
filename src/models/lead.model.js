import { Schema, model } from "mongoose";

// Same { hash, encrypted } shape as schemas/phone.schema.js, but its own sub-schema: that shared one
// already puts a plain index on `hash`, and a second UNIQUE index on the same key (what "one spin per
// phone" needs) makes MongoDB refuse to build either - the app then fails to start.
const LeadPhoneSchema = new Schema(
  {
    hash: { type: String, required: true },
    encrypted: { type: String, required: true },
  },
  { _id: false }
);

export const LEAD_SEGMENTS = ["usluge", "kozmetika", "b2b"];

// A contact collected through the prize wheel (/tocak) at a fair/event. Separate from
// Contact (an inquiry with a message) and NewsLetter (email-only, opt-in): a lead always
// has name + email + phone, one spin each (unique email and unique phone hash), and
// links to the single-use Coupon it won. Newsletter membership is a separate, optional
// consent (consentMarketing) handled through news-letter.service.js's subscribe().
const LeadSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    // encrypted ciphertext at rest (same convention as Contact.lastName)
    lastName: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // { hash, encrypted } - hash is what makes "one spin per phone" possible
    phone: { type: LeadPhoneSchema, required: true },

    segment: { type: String, enum: LEAD_SEGMENTS, required: true, index: true },
    // which QR/event brought them here, e.g. "sajam-ns-2026"
    source: { type: String, trim: true, default: "tocak", index: true },

    consentContact: { type: Boolean, required: true },
    consentMarketing: { type: Boolean, default: false },

    prize: { type: Schema.Types.ObjectId, ref: "WheelPrize", required: true },
    prizeLabel: { type: String, required: true },
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    couponCode: { type: String, required: true },
    couponValidUntil: { type: Date, required: true },

    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

LeadSchema.index({ "phone.hash": 1 }, { unique: true });
LeadSchema.index({ createdAt: -1 });

export default model("Lead", LeadSchema);
