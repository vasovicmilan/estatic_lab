import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import VideoSchema from "./schemas/video.schema.js";
import FAQSchema from "./schemas/faq.schema.js";
import ProductVariationSchema from "./schemas/product-variation.schema.js";
import { badRequest } from "../utils/error.util.js";

const ProductSchema = new Schema(
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
    // the product's own model/part number - always present and unique, independent of
    // whether individual variations also carry their own sku (ProductVariationSchema.sku)
    sku: {
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

    variations: {
      type: [ProductVariationSchema],
      default: [],
    },

    // spare parts/accessories/consumables commonly used alongside this product - e.g.
    // a device linking to its compatible replacement heads, or a serum linking to its
    // travel-size version. Deliberately a flat list (not a typed "compatible vs upsell
    // vs accessory" split) to start - can be split apart later if one relationship
    // needs more structure than the others.
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],

    faq: [FAQSchema],

    // Independent of isActive (published/draft) - this is purely a merchandising
    // classification for the shop landing page (featured section, sale section),
    // not a stock/availability signal. "sale" doesn't compute a discount itself -
    // pair it with a variation's compareAtPrice to actually show a struck-through
    // price; this field is just "should this show up in the sale section".
    badge: {
      type: String,
      enum: ["none", "featured", "sale"],
      default: "none",
      index: true,
    },

    // "standard" = ships via regular post at the flat DEFAULT_SHIPPING_PRICE rate
    // (see shop.config.js) - fine for lightweight consumables/accessories. "freight" =
    // too large/heavy for regular post (e.g. multi-kg devices) - checkout can't quote
    // an automatic price for these, so an admin sets the real shipping cost by hand
    // before confirming the order (see temporary-order.service.js's shipping
    // resolution and Order/TemporaryOrder's requiresShippingQuote flag). Product-level,
    // not per-variation - a device's physical size doesn't change between color/size
    // variants the way its price does.
    shippingClass: {
      type: String,
      enum: ["standard", "freight"],
      default: "standard",
    },

    // For products whose real cost is too volatile to quote automatically (e.g.
    // shipping/import cost from the supplier swings too much) - the public site
    // shows "Cena na upit" instead of a price and a "contact us" link instead of
    // "add to cart" (see product.mapper.js / product-details.ejs), and the sale
    // itself happens through an admin-created order with a hand-entered price
    // (see order.service.js's createManualOrder), never through normal checkout.
    // Product-level, not per-variation (see the design discussion this came
    // from) - variations still carry their own `price` field as an internal
    // reference/estimate, it's just never shown to the public while this is true.
    priceOnRequest: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Mirrors service.model.js: a product can be saved as an incomplete draft, but
// publishing it (isActive: true) requires it to actually be sellable - a photo and
// at least one purchasable variation. Keeps price/stock resolution on a single code
// path (always through `variations`, never a product-level fallback price/stock).
function validatePublishInvariants(doc) {
  if (!doc.isActive) return;
  if (!doc.image) badRequest("Objavljen proizvod mora imati sliku.");
  if (!doc.variations?.length) {
    badRequest("Objavljen proizvod mora imati bar jednu varijantu za prodaju.");
  }
}

ProductSchema.pre("save", function () {
  validatePublishInvariants(this);
});

ProductSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const patch = { ...update, ...(update.$set || {}) };
  const touchesRelevantFields = ["isActive", "image", "variations"].some((key) => key in patch);
  if (!touchesRelevantFields) return;

  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;
  const merged = { ...current, ...patch };
  validatePublishInvariants(merged);
});

ProductSchema.index({ categories: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ "variations.sku": 1 });

export default model("Product", ProductSchema);