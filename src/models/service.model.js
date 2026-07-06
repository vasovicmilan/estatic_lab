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
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

function validateComparisonTable(doc) {
  if (doc.comparisonTable?.length && doc.comparisonColumns?.length) {
    for (const row of doc.comparisonTable) {
      if (row.values.length !== doc.comparisonColumns.length) {
        throw new Error(
          `Red "${row.label}" ima ${row.values.length} vrednosti, a očekivano je ${doc.comparisonColumns.length}.`
        );
      }
    }
  }
}

function validatePublishInvariants(doc) {
  if (!doc.isActive) return;
  if (!doc.image) throw new Error("Objavljena usluga mora imati sliku.");
  if (!doc.packages?.length) {
    throw new Error("Objavljena usluga mora imati bar jednu varijantu (paket) za zakazivanje.");
  }
}

ServiceSchema.pre("save", function () {
  validateComparisonTable(this);
  validatePublishInvariants(this);
});

ServiceSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const patch = { ...update, ...(update.$set || {}) };
  const touchesRelevantFields = ["isActive", "image", "packages", "comparisonTable", "comparisonColumns"].some(
    (key) => key in patch
  );
  if (!touchesRelevantFields) return;

  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;
  const merged = { ...current, ...patch };
  validateComparisonTable(merged);
  validatePublishInvariants(merged);
});

ServiceSchema.index({ categories: 1 });
ServiceSchema.index({ tags: 1 });
ServiceSchema.index({ employees: 1 });

export default model("Service", ServiceSchema);