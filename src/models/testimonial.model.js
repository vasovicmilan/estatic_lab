import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";

const TestimonialSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // optional link to the account that submitted it, if they were logged in
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // optional link to which service the review is about
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },

    // optional link to which package the review is about - mutually exclusive
    // with `service` in practice (set by whichever detail page the form was on),
    // but not enforced at the schema level
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },

    // optional link to which product the review is about - same convention as
    // service/package: whichever detail page the form was submitted from sets
    // exactly one of the three
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    image: ImageSchema,

    // every testimonial starts pending and requires admin approval before it's public -
    // prevents spam/abuse from showing up on the site immediately
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },

    // GDPR: explicit, unchecked-by-default consent to publicly display this
    // testimonial (name/image/text). Required at submission - see
    // testimonial.service.js's submitTestimonial(), which rejects the request
    // outright if this isn't true. Kept separate from `status` because consent
    // is about the person's permission, not our internal moderation decision.
    consentGiven: {
      type: Boolean,
      required: true,
      default: false,
    },
    consent: {
      givenAt: { type: Date, default: null },
      ipAddress: { type: String, default: null },
      // free-text snapshot of the consent copy shown on the form at submit
      // time, so we can prove exactly what the person agreed to even if the
      // wording on the form changes later.
      textVersion: { type: String, default: null },
    },
  },
  { timestamps: true }
);

TestimonialSchema.index({ status: 1, isFeatured: 1 });
TestimonialSchema.index({ service: 1 });
TestimonialSchema.index({ product: 1 });

export default model("Testimonial", TestimonialSchema);