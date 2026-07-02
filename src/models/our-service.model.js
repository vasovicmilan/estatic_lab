import mongoose from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import ServiceFeatureSchema from "./schemas/service-feature.schema.js";
import ServicePackageSchema from "./schemas/service-package.schema.js";
import ComparisonRowSchema from "./schemas/comparison-row.schema.js";

const { Schema, model } = mongoose;

const OurServiceSchema = new Schema(
  {
    name: {
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
    shortDescription: String,
    longDescription: String,

    type: {
      type: String,
      enum: ["esma", "massage"],
      required: true,
      index: true,
    },

    defaultDuration: {
      type: Number,
      default: 60,
    },

    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    image: {
      type: ImageSchema,
      required: true,
    },
    gallery: [ImageSchema],

    videos: [VideoSchema],

    seoKeywords: [String],

    highlight: {
      type: Boolean,
      default: false,
      index: true,
    },
    ctaText: {
      type: String,
      default: "Zakaži konsultaciju",
    },

    features: {
      type: [ServiceFeatureSchema],
      default: [],
    },

    packages: {
      type: [ServicePackageSchema],
      default: [],
    },

    comparisonColumns: {
      type: [String],
      default: [],
    },
    comparisonTable: {
      type: [ComparisonRowSchema],
      default: [],
    },

    faq: [FAQSchema],

    employees: [
      {
        type: Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

OurServiceSchema.pre("save", function (next) {
  if (this.comparisonTable && this.comparisonColumns.length) {
    for (const row of this.comparisonTable) {
      if (row.values.length !== this.comparisonColumns.length) {
        return next(
          new Error(
            `Row "${row.label}" has ${row.values.length} values but ${this.comparisonColumns.length} columns`
          )
        );
      }
    }
  }
  next();
});

OurServiceSchema.index({ categories: 1 });
OurServiceSchema.index({ tags: 1 });

export default model("OurService", OurServiceSchema);