import { Schema } from "mongoose";

/**
 * Video reference (self-hosted via fluent-ffmpeg processed files, or embedded/external URL).
 */
const VideoSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    isExternal: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

export default VideoSchema;
