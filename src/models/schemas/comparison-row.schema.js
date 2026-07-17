import { Schema } from "mongoose";

/**
 * One row of a comparison table (e.g. "Duration | 30min | 60min | 90min").
 * `values.length` must match the parent document's `comparisonColumns.length` -
 * validated in a pre('save') hook on the parent (Service).
 */
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
