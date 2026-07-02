import { Schema } from "mongoose";

const ImageSchema = new Schema(
  {
    img: { type: String, trim: true },
    imgDesc: { type: String },
  },
  { _id: false }
);

export default ImageSchema;