import mongoose from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import FAQSchema from "./schemas/faq.schema.js";

const { Schema, model } = mongoose;

/**
 * FEATURES (šta servis radi)
 */
const serviceFeatureSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    icon: { type: String }, // npr "bi bi-lightning-charge"
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { _id: true }
);

/**
 * PACKAGES (kako se servis prodaje) – ostavljamo ugrađene pakete
 * za jednostavne ponude, ali preporučujemo korišćenje posebnog
 * modela Package (vidi dole) za kombinovane pakete.
 */
const servicePackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    sessions: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    basePrice: { type: Number },
    badge: { type: String },
    isBest: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    duration: { type: Number, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { _id: true }
);

/**
 * COMPARISON TABLE
 */
const comparisonRowSchema = new Schema(
  {
    label: { type: String, required: true },
    values: { type: [String], required: true },
  },
  { _id: false }
);

/**
 * SERVICE
 */
const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: String,
    longDescription: String,
    type: {
      type: String,
      enum: ["esma", "massage"],
      required: true,
      index: true,
    },
    // Dodato – podrazumevano trajanje (u minutima) za većinu tretmana
    defaultDuration: {
      type: Number,
      default: 60, // primer
    },

    categories: [
      { type: Schema.Types.ObjectId, ref: "Category" }
    ],
    tags: [
      { type: Schema.Types.ObjectId, ref: "Tag" }
    ],

    image: { type: ImageSchema, required: true },
    gallery: [ImageSchema],

    seoKeywords: [String],

    highlight: { type: Boolean, default: false, index: true }, // dodan indeks
    ctaText: { type: String, default: "Zakaži konsultaciju" },

    features: { type: [serviceFeatureSchema], default: [] },
    packages: { type: [servicePackageSchema], default: [] },

    comparisonColumns: { type: [String], default: [] },
    comparisonTable: { type: [comparisonRowSchema], default: [] },

    faq: [FAQSchema],

    employees: [
      { type: Schema.Types.ObjectId, ref: "Employee" }
    ],

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Validacija uporedne tabele
serviceSchema.pre('save', function (next) {
  if (this.comparisonTable && this.comparisonColumns.length) {
    for (let row of this.comparisonTable) {
      if (row.values.length !== this.comparisonColumns.length) {
        next(new Error(`Row "${row.label}" has ${row.values.length} values but ${this.comparisonColumns.length} columns`));
      }
    }
  }
  next();
});

// Indeksi
serviceSchema.index({ type: 1, isActive: 1 });
serviceSchema.index({ categories: 1 });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ highlight: 1 }); // za brzo dohvatanje istaknutih

export default model("Service", serviceSchema);