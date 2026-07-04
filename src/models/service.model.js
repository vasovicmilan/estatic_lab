import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import ServiceFeatureSchema from "./schemas/service-feature.schema.js";
import ServicePackageSchema from "./schemas/service-package.schema.js";
import ComparisonRowSchema from "./schemas/comparison-row.schema.js";

/**
 * A single treatment/service offered by the wellness center (e.g. "Deep Tissue Massage").
 * Consolidates the two near-duplicate models found in the reference codebase
 * (service.model.js and our-service.model.js) into one — this is the model
 * `Appointment.service` and `Employee.services[]` point to.
 *
 * `packages[]` here are the *bookable variants* of this one service (e.g. "60 min" vs
 * "90 min" vs "5-session bundle") — see schemas/service-package.schema.js. Don't confuse
 * this with the top-level `Package` model, which combines multiple different services.
 */
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

    // default duration (minutes) used by the availability engine when a specific
    // package/variant isn't picked yet (e.g. showing a generic slot grid before checkout)
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

    // bookable variants — see file-level comment
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

    // which employees can perform this service — drives availability lookups
    employees: [{ type: Schema.Types.ObjectId, ref: "Employee" }],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

ServiceSchema.pre("save", function (next) {
  if (this.comparisonTable?.length && this.comparisonColumns?.length) {
    for (const row of this.comparisonTable) {
      if (row.values.length !== this.comparisonColumns.length) {
        return next(
          new Error(
            `Red "${row.label}" ima ${row.values.length} vrednosti, a očekivano je ${this.comparisonColumns.length}.`
          )
        );
      }
    }
  }
  next();
});

ServiceSchema.index({ isActive: 1 });
ServiceSchema.index({ categories: 1 });
ServiceSchema.index({ tags: 1 });
ServiceSchema.index({ highlight: 1 });
ServiceSchema.index({ employees: 1 });

export default model("Service", ServiceSchema);
