import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";
import ContentBlogSchema from "./schemas/content.blog.schema.js";

/**
 * Blog post. Reuses the shared Category/Tag models scoped to domain: "post".
 * SEO fields here feed seo/builders/post.builder.js + seo/contracts/post.contract.js.
 *
 * "scheduled" sits between draft and published: the post is finished and queued
 * with a future scheduledFor date, and jobs/post-jobs.js's cron sweep flips it to
 * "published" once that date arrives (see PostSchema.pre("save") below, which sets
 * publishedAt the same way it already does for a manual draft->published change).
 */
export const POST_STATUSES = ["draft", "scheduled", "published", "archived"];

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

    // structured, block-based body - see schemas/content.blog.schema.js
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

    // authored by a staff member - either an admin or an employee (e.g. a therapist
    // writing about their specialty). Not a public User to avoid guest accounts authoring posts.
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

    // only meaningful while status === "scheduled" - the cron sweep in
    // jobs/post-jobs.js queries on this. Left populated after publish (harmless,
    // and useful as "this is when it was originally meant to go out" history).
    scheduledFor: {
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

    // informational, computed at save time from content length; used in the UI ("5 min read")
    readingTimeMinutes: {
      type: Number,
      default: 1,
    },

    views: {
      type: Number,
      default: 0,
    },

    // lets the admin pin a post to the top of the public blog listing regardless
    // of publishedAt - same isFeatured + order convention as TestimonialSchema.
    // featuredOrder only matters relative to other featured posts (lower first);
    // meaningless while isFeatured is false.
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PostSchema.pre("save", function () {
  if (this.isModified("content")) {
    const words = this.content
      .filter((b) => b.type === "paragraph" || b.type === "heading" || b.type === "quote")
      .reduce((sum, b) => sum + (b.text ? b.text.trim().split(/\s+/).length : 0), 0);
    this.readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  }

  if (this.isModified("status") && this.status === "scheduled") {
    if (!this.scheduledFor) {
      throw new Error("Zakazan post mora imati datum i vreme objave (scheduledFor).");
    }
    if (this.scheduledFor <= new Date()) {
      throw new Error("Datum zakazivanja mora biti u budućnosti.");
    }
  }

  // covers both the manual draft->published transition and the cron sweep's
  // scheduled->published transition (post-jobs.js updates status via .save() on
  // individual docs specifically so this hook fires and publishedAt gets set here,
  // in one place, instead of being duplicated in the job).
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// post.service.js's updatePostStatus (the admin "publish now" action) goes through
// postRepo.updatePostById -> Post.findByIdAndUpdate, which does NOT run the
// pre("save") hook above - so without this, a manual draft->published click would
// never get a publishedAt. Mirrors that hook's publishedAt logic for the
// findOneAndUpdate path specifically.
PostSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const patch = { ...update, ...(update.$set || {}) };
  if (patch.status !== "published") return;
  // an explicit publishedAt in this same update (e.g. a seed backdating posts, or
  // a future caller intentionally setting it) always wins over the auto-set below
  if (patch.publishedAt) return;

  const current = await this.model.findOne(this.getQuery()).select("publishedAt").lean();
  if (current?.publishedAt) return;

  this.set({ publishedAt: new Date() });
});

PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ status: 1, scheduledFor: 1 });
PostSchema.index({ status: 1, isFeatured: 1, featuredOrder: 1 });
PostSchema.index({ categories: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ author: 1 });

export default model("Post", PostSchema);