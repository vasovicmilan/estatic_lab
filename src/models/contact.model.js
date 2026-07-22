import { Schema, model } from "mongoose";

const ContactSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    // encrypted ciphertext at rest - trimming happens on the plaintext before
    // encryption (encryptField()), not here, since trimming ciphertext is meaningless
    lastName: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    // optional - encrypted ciphertext when present, unset when not provided
    phone: { type: String },

    topic: {
      type: String,
      trim: true,
    },
    // encrypted ciphertext at rest
    message: {
      type: String,
      required: true,
    },

    consent: {
      type: Boolean,
      required: true,
      default: false,
    },

    status: {
      type: String,
      enum: ["new", "read", "replied", "archived"],
      default: "new",
      index: true,
    },

    // abuse/audit trail - not shown in the UI
    ip: String,
    userAgent: String,

    // only set when the contact page was reached via ?tema= (a specific
    // package/service inquiry link, not a generic "contact us") AND a referral
    // cookie was active at that moment - never attached to a generic inquiry
    // just because a stale cookie happens to exist from unrelated browsing
    referralCode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

ContactSchema.index({ status: 1, createdAt: -1 });

export default model("Contact", ContactSchema);