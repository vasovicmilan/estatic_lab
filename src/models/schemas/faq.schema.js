import { Schema } from "mongoose";

const FAQSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "bi bi-question-circle",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export default FAQSchema;