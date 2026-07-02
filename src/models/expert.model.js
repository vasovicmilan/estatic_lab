import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";

const ExpertSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
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

    title: {
      type: String,
      trim: true,
    },
    shortBio: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    bio: {
      type: String,
      trim: true,
    },

    image: {
      type: ImageSchema,
      required: true,
    },
    gallery: [ImageSchema],

    specializations: [String],
    services: [{ type: Schema.Types.ObjectId, ref: "Service" }],

    socialLinks: {
      instagram: { type: String, trim: true },
      facebook: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      website: { type: String, trim: true },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ExpertSchema.index({ isActive: 1, order: 1 });
ExpertSchema.index({ services: 1 });

export default model("Expert", ExpertSchema);