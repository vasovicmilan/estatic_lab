import { Schema } from "mongoose";
import ImageSchema from "./image.schema.js";

/**
 * A purchasable variant of a Product - e.g. "50ml" vs "100ml" for a consumable,
 * "Type A replacement head" vs "Type B" for a spare part, or just "Standard" for a
 * product that doesn't really vary. Deliberately freeform (`label`, not `size`/`color`)
 * since the catalog is cosmetic equipment/devices/parts/consumables, not apparel -
 * unlike a clothing shop, there's no single axis every product varies along.
 *
 * For now, input on the admin side can be constrained with a per-category enum/select
 * (e.g. a dropdown of common volumes) without that constraint living in the schema -
 * keeps the data model flexible while the UI keeps entry consistent.
 *
 * This is what gets snapshotted onto Order/OrderItem at purchase time, same role
 * ServicePackageSchema plays for Appointment.variant.
 */
const ProductVariationSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // optional - only needed when a specific variation has its own distinct part/
    // consumable code worth tracking separately from the product's own `sku`
    sku: {
      type: String,
      trim: true,
      default: null,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // optional, for showing a struck-through "was" price when discounted - same
    // convention as ServicePackageSchema.basePrice
    compareAtPrice: {
      type: Number,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // below this quantity, a low-stock Telegram/email alert fires (see product.service.js)
    // - per-variation since a device and a small consumable for it realistically need
    // very different thresholds
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },

    image: {
      type: ImageSchema,
      default: null,
    },

    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { _id: true }
);

export default ProductVariationSchema;