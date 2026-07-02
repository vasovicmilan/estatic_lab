import { Schema } from "mongoose";

const ComparisonRowSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
    },
    values: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Values array cannot be empty",
      },
    },
  },
  { _id: false }
);

export default ComparisonRowSchema;