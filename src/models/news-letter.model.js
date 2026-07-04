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

    // used to build a one-click unsubscribe link without requiring login
    unsubscribeToken: {
      type: String,
      required: true,
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

NewsLetterSchema.index({ email: 1 }, { unique: true });
NewsLetterSchema.index({ status: 1 });

export default model("NewsLetter", NewsLetterSchema);
