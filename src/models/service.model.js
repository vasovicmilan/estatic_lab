import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import ServiceFeatureSchema from "./schemas/service-feature.schema.js";
import ServicePackageSchema from "./schemas/service-package.schema.js";
import ComparisonRowSchema from "./schemas/comparison-row.schema.js";

const ServiceSchema = new Schema(
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

    shortDescription: {
      type: String,
      trim: true,
    },
    longDescription: {
      type: String,
    },

    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],

    image: {
      type: ImageSchema,
      required: true,
    },
    gallery: [ImageSchema],
    videos: [VideoSchema],

    seoKeywords: [String],

    defaultDuration: {
      type: Number,
      default: 60,
    },

    highlight: {
      type: Boolean,
      default: false,
      index: true,
    },
    ctaText: {
      type: String,
      default: "Zakaži termin",
    },

    features: {
      type: [ServiceFeatureSchema],
      default: [],
    },

    packages: {
      type: [ServicePackageSchema],
      default: [],
      validate: {
        validator: (v) => v && v.length > 0,
        message: "Usluga mora imati bar jednu varijantu (paket) za zakazivanje.",
      },
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

    employees: [{ type: Schema.Types.ObjectId, ref: "Employee" }],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

ServiceSchema.pre("save", function () {
  if (this.comparisonTable?.length && this.comparisonColumns?.length) {
     for (const row of this.comparisonTable) {
       if (row.values.length !== this.comparisonColumns.length) {
        throw new Error(
          `Red "${row.label}" ima ${row.values.length} vrednosti, a očekivano je ${this.comparisonColumns.length}.`
        );
      }
    }
  }
});

ServiceSchema.index({ categories: 1 });
ServiceSchema.index({ tags: 1 });
ServiceSchema.index({ employees: 1 });

export default model("Service", ServiceSchema);
