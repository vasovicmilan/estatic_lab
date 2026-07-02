import { Schema } from "mongoose";

const VideoSchema = new Schema(
  {
    url: {
      type: String,
      trim: true,
    },
    filePath: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
    },
    provider: {
      type: String,
      enum: ["youtube", "vimeo", "local", "custom"],
      default: "local",
    },
    providerId: {
      type: String,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
    },
  },
  { _id: false }
);

export default VideoSchema;