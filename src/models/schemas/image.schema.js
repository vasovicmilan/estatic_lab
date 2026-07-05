import { Schema } from "mongoose";

const ImageSchema = new Schema(
  {
    img: {
      type: String,
      required: true,
      trim: true,
    },
    imgDesc: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

export default ImageSchema;
