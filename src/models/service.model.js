import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import ServiceFeatureSchema from "./schemas/service-feature.schema.js";
import { badRequest } from "../utils/error.util.js";
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

    // Every shared physical thing an appointment for this service must hold
    // AT THE SAME TIME - a massage table, an ESMA device, a room. Almost
    // never actually empty in practice (nearly every service occupies at
    // least one physical thing), but an empty array is still the correct,
    // well-defined way to express "no shared-capacity constraint" for the
    // rare service that has none (e.g. a phone consultation).
    //
    // This is a LIST, not a single resource, because one appointment can
    // depend on more than one resource pool at once - an ESMA appointment
    // needs both the ESMA device AND a table to lie on, and those come from
    // two independent pools that can each become the bottleneck on their
    // own (e.g. 3 devices but only 2 tables). Availability/booking requires
    // EVERY resource in this list to have room - see Resource model and
    // availability.service.js/appointment.service.js for how that's enforced.
    //
    // This does NOT support "either A or B" alternative resources (e.g. "a
    // table OR a chair, whichever's free") - every entry here is required,
    // not optional. That's a deliberately unbuilt feature for now; if it's
    // ever needed, it should be a separate field (e.g. resourceAlternatives,
    // an array of alternative-groups) rather than overloading this one, so
    // existing AND-composition here doesn't need to change to support it.
    resources: [{ type: Schema.Types.ObjectId, ref: "Resource" }],

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

    // products used during/recommended alongside this service - e.g. the specific
    // cosmetic preparation a therapy actually applies, or a retail product to
    // suggest as aftercare. The inverse of Product.relatedServices (see
    // product.model.js) - see that field's comment for why this is two independent
    // arrays rather than a shared join collection.
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],

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
        badRequest(`Red "${row.label}" ima ${row.values.length} vrednosti, a očekivano je ${doc.comparisonColumns.length}.`);
      }
    }
  }
}

function validatePublishInvariants(doc) {
  if (!doc.isActive) return;
  if (!doc.image) badRequest("Objavljena usluga mora imati sliku.");
  if (!doc.packages?.length) {
    badRequest("Objavljena usluga mora imati bar jednu varijantu (paket) za zakazivanje.");
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
ServiceSchema.index({ resources: 1 });

export default model("Service", ServiceSchema);