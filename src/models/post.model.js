import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import ContentBlogSchema from "./schemas/content.blog.schema.js";

export const POST_STATUSES = ["draft", "published", "archived"];

const PostSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    excerpt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    content: {
      type: [ContentBlogSchema],
      default: [],
    },

    coverImage: {
      type: ImageSchema,
      required: true,
    },
    gallery: [ImageSchema],

    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: POST_STATUSES,
      default: "draft",
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },

    seo: {
      title: { type: String, trim: true },
      description: { type: String, trim: true, maxlength: 160 },
      keywords: [String],
    },

    isIndexable: {
      type: Boolean,
      default: true,
      index: true,
    },

    readingTimeMinutes: {
      type: Number,
      default: 1,
    },

    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PostSchema.pre("save", function (next) {
  if (this.isModified("content")) {
    const words = this.content
      .filter((b) => b.type === "paragraph" || b.type === "heading" || b.type === "quote")
      .reduce((sum, b) => sum + (b.text ? b.text.trim().split(/\s+/).length : 0), 0);
    this.readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  }
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ categories: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ author: 1 });

export default model("Post", PostSchema);