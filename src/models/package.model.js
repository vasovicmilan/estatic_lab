import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import PackageItemSchema from "./schemas/package-item-schema.js";

const PackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    description: { type: String, required: true },
    shortDescription: { type: String, trim: true },

    items: {
      type: [PackageItemSchema],
      validate: {
        validator: (v) => v && v.length > 0,
        message: "Paket mora sadržati bar jednu uslugu.",
      },
    },

    totalPrice: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, min: 0 },
    totalDuration: { type: Number, min: 0 },

    badge: { type: String, trim: true },
    isBest: { type: Boolean, default: false },
    order: { type: Number, default: 0 },

    image: ImageSchema,
    gallery: [ImageSchema],
    videos: [VideoSchema],

    seoKeywords: [String],

    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],

    faq: [FAQSchema],

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

PackageSchema.index({ isActive: 1 });
PackageSchema.index({ categories: 1 });
PackageSchema.index({ tags: 1 });
PackageSchema.index({ "items.service": 1 });

export default model("Package", PackageSchema);