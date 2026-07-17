import { Schema } from "mongoose";
import ImageSchema from "./image.schema.js";

const OrderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // traces back to Product.variations[]._id - kept even though everything useful
    // about the variation is snapshotted below, same reasoning Appointment.variant
    // keeps servicePackageId alongside its own snapshotted name/duration/price
    variant: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    title: { type: String, required: true, trim: true },
    variantLabel: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },

    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },

    image: {
      type: ImageSchema,
      default: null,
    },
  },
  { _id: false }
);

export default OrderItemSchema;