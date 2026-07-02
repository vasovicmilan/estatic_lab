import { Schema, model } from "mongoose";

const ContactSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },

    topic: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
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

    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

ContactSchema.index({ status: 1, createdAt: -1 });

export default model("Contact", ContactSchema);