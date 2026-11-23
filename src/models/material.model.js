import { Schema, model } from "mongoose";

// A downloadable file (offer, brochure, price list...) that the admin uploads once and then
// reuses: its own public page + QR code (/materijali/:slug) and a "file" block in newsletter
// campaigns. The file itself lives OUTSIDE src/public (MATERIALS_DIR, see
// config/material-upload.config.js), so a manual deploy of src/ can never overwrite it and it
// is only reachable through the download route, which counts the downloads.
const MaterialFileSchema = new Schema(
  {
    // random name on disk - never the uploaded name, so nothing a visitor sends ends up in a path
    storedName: { type: String, required: true },
    // what the visitor's browser saves it as
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MaterialSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    // fixed after creation: the QR code and campaign links point at it
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    file: { type: MaterialFileSchema, required: true },
    isActive: { type: Boolean, default: true, index: true },
    // page opens (QR scans / link clicks) and actual file downloads
    viewCount: { type: Number, default: 0, min: 0 },
    downloadCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

MaterialSchema.index({ createdAt: -1 });

export default model("Material", MaterialSchema);
