import { Schema, model } from "mongoose";
import ContentBlogSchema from "./schemas/content.blog.schema.js";
import { NEWSLETTER_INTERESTS } from "./news-letter.model.js";

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sent"];

// Which block types are safe to render in an email client - a deliberately
// smaller list than BLOG_BLOCK_TYPES (post/product content). gallery/video/table/
// cards/callout/faq/quote/list all either need CSS Grid/Flexbox layouts most
// email clients strip, or JS/media embeds that don't work in mail at all.
// heading/paragraph/image/cta/divider/serviceReference/productReference all
// render down to plain tables and inline styles - see campaign-content.util.js's
// renderCampaignContentToEmailHtml, the one place that actually turns these into
// HTML for sending.
export const CAMPAIGN_BLOCK_TYPES = ["heading", "paragraph", "image", "cta", "serviceReference", "productReference", "divider"];

const CampaignSchema = new Schema(
  {
    // internal name shown in the admin list - NOT what the subscriber sees
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // the actual email subject line
    subject: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: [ContentBlogSchema],
      default: [],
    },

    // which segments this campaign goes to - empty array means "everyone
    // currently subscribed", not "nobody" (see campaign.service.js's
    // sendCampaignNow, which reads it that way)
    targetInterests: {
      type: [String],
      enum: NEWSLETTER_INTERESTS,
      default: [],
    },

    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      default: "draft",
      index: true,
    },

    // only meaningful while status === "scheduled" - jobs/campaign-jobs.js's cron
    // sweep queries on this, same pattern as Post.scheduledFor/jobs/post-jobs.js.
    // Left populated after sending (harmless, useful as send-time history).
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    // per-recipient outcome counts from the last (only) send attempt - a
    // campaign is fire-once, see campaign.service.js's guard against
    // re-sending an already-sent campaign
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

CampaignSchema.pre("save", function () {
  if (this.isModified("status") && this.status === "scheduled") {
    if (!this.scheduledFor) {
      throw new Error("Zakazana kampanja mora imati datum i vreme slanja (scheduledFor).");
    }
    if (this.scheduledFor <= new Date()) {
      throw new Error("Datum zakazivanja mora biti u budućnosti.");
    }
  }
});

CampaignSchema.index({ status: 1, scheduledFor: 1 });

export default model("Campaign", CampaignSchema);
