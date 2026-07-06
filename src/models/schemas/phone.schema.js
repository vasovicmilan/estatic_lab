import { Schema } from "mongoose";

const PhoneSchema = new Schema(
  {
    hash: { type: String, index: true },
    encrypted: { type: String },
  },
  { _id: false }
);

export default PhoneSchema;