import { Schema, model } from "mongoose";

// What visitors and customers DO on the site (cart, coupons, checkout, bookings,
// forms, newsletter) - kept apart from AuditLog on purpose:
//  - AuditLog is the trail of staff/admin actions and account security events;
//    mixing high-volume visitor behaviour into it would bury those.
//  - Different retention: IP + user agent of a visitor are personal data, so these
//    entries expire after 12 months instead of 2 years.
//  - Erasure is simple: anonymizing/deleting a user deletes every entry with their
//    userId (see userActivityLogService.deleteForUser) without touching the admin trail.
// Values of personal fields never go in here (see audit-redaction.util.js) - entries
// carry ids and non-personal facts only, e.g. which product, how many, which coupon code.
const UserActivityLogSchema = new Schema(
  {
    // Retention: 12 months. MongoDB's TTL monitor deletes entries once `timestamp` is
    // older than `expireAfterSeconds`; no cron job needed.
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // null for a guest (not logged in)
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // role name at the time of the action ("user", "employee", "admin"...), "guest" when not logged in
    role: { type: String, default: "guest" },
    // groups the actions of one visit together without storing the raw session id:
    // an HMAC of the session id, truncated. Changes on login (the session is regenerated).
    sessionKey: { type: String, default: null },

    // SCREAMING_SNAKE_CASE, e.g. "CART_ITEM_ADDED" - not an enum, the list grows
    action: { type: String, required: true },

    // what the action was about: { type: "Product", id } - Mixed id like AuditLog.entity.id
    entity: {
      type: { type: String, default: null },
      id: { type: Schema.Types.Mixed, default: null },
    },

    // non-personal details: { variantId, quantity }, { code, discountAmount }...
    meta: { type: Schema.Types.Mixed, default: null },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null },

    success: { type: Boolean, required: true, default: true },
    errorMessage: { type: String, default: null },
  },
  { timestamps: false }
);

// "everything this user did, most recent first" - the user history tabs
UserActivityLogSchema.index({ userId: 1, timestamp: -1 });
// "everything that happened to this entity" - also how a guest's order confirmation is tied back to the order's owner
UserActivityLogSchema.index({ "entity.type": 1, "entity.id": 1, timestamp: -1 });
// "what did this visit do"
UserActivityLogSchema.index({ sessionKey: 1, timestamp: -1 });
// admin list filter + the interest summary
UserActivityLogSchema.index({ action: 1, timestamp: -1 });

// TTL index, 12-month retention: 365 days * 86400 seconds/day = 31536000
export const USER_ACTIVITY_RETENTION_SECONDS = 365 * 24 * 60 * 60;
UserActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: USER_ACTIVITY_RETENTION_SECONDS });

export default model("UserActivityLog", UserActivityLogSchema);
