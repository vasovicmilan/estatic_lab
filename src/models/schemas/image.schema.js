import { Schema } from "mongoose";

/**
 * Generic image reference used across Service, Package, Post, Employee, etc.
 * `img` stores the relative/public path (see multer.config.js upload targets),
 * `imgDesc` is the alt text — required for accessibility + image SEO.
 */
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
