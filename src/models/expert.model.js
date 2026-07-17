import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";

/**
 * A public-facing "our experts" profile. Deliberately independent of User/Employee -
 * you should be able to populate a full team page with zero login accounts behind it
 * (e.g. the studio owner running everything solo while the site shows a full expert roster).
 *
 * If/when an Expert becomes real staff who logs in and takes appointments, create an
 * Employee document and set Employee.expert to this document's _id - the bio/photo/title
 * stay canonical here, Employee only adds the auth+scheduling concerns on top.
 * See employee.model.js for the other side of that link.
 */
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
      type: String, // e.g. "Senior Aesthetician"
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

    // purely informational/display - NOT used by the booking/availability engine.
    // Real bookability is driven entirely by Employee.services[] once (if) this
    // expert gets a staff account.
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
