import { Schema } from "mongoose";

/**
 * FAQ entry, embedded on Service, Package, Post, or a future standalone FAQ page.
 */
const FAQSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

export default FAQSchema;
