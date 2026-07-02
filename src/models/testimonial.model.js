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

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
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
  },
  { timestamps: true }
);

TestimonialSchema.index({ status: 1, isFeatured: 1 });
TestimonialSchema.index({ service: 1 });

export default model("Testimonial", TestimonialSchema);