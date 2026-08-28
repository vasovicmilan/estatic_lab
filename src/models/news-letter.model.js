import { Schema, model } from "mongoose";

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
