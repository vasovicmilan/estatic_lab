import { Schema } from "mongoose";

const ComparisonRowSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    values: {
      type: [String],
      required: true,
    },
  },
  { _id: false }
);

export default ComparisonRowSchema;