import { Schema, model } from "mongoose";

// One entry per legacy path that used to serve real content (a since-deleted/
// renamed tag, category, post, etc.) and now needs an explicit fate instead
// of falling through to a plain 404 - see notFoundHandler in
// error.middleware.js, which handles everything NOT matched here.
//
// type "redirect": 301 to `target` - use when the content moved/was renamed
// and a live equivalent page exists.
// type "gone": 410 - use when the content was deliberately and permanently
// removed with no replacement. Preferred over a bare 404 for URLs that were
// previously indexed, since it tells search engines to drop the URL rather
// than keep re-checking it.
const RedirectSchema = new Schema(
  {
    sourcePath: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // stored WITHOUT query string - matched against req.path, not
      // req.originalUrl, so ?utm_source=... etc. on an old link still redirects
    },
    type: {
      type: String,
      enum: ["redirect", "gone"],
      required: true,
    },
    target: {
      type: String,
      trim: true,
      default: null, // required in practice for type "redirect", enforced in redirect.service.js
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default model("Redirect", RedirectSchema);
