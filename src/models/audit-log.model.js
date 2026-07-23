import { Schema, model } from "mongoose";

const AuditLogSchema = new Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    actor: {
      id: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null for unauthenticated/system actions
      email: { type: String, default: null },
      role: { type: String, default: null }, // role name at the time of the action, not a live ref - if the role is later renamed or deleted, this entry still shows what it was called then
    },

    // SCREAMING_SNAKE_CASE convention, e.g. "PRODUCT_UPDATED", "COUPON_STATUS_CHANGED",
    // "PARTNER_CREATED", "PAYOUT_APPROVED" - see audit-log.util.js for the actions
    // currently wired in; not an enum on purpose, since this list will grow as more
    // actions get instrumented and shouldn't require a schema migration each time
    action: {
      type: String,
      required: true,
      index: true,
    },

    entity: {
      type: { type: String, default: null }, // e.g. "Product", "Coupon", "Partner", "PayoutRequest"
      id: { type: Schema.Types.ObjectId, default: null },
    },

    // per-field before/after pairs for whatever actually changed - e.g.
    // { price: { old: 2990, new: 2490 } } - deliberately NOT a full before/after
    // snapshot of the whole document, just the fields that were tracked and
    // actually differed, so this stays readable instead of becoming a full
    // document dump on every single edit
    changes: {
      type: Schema.Types.Mixed,
      default: null,
    },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null, index: true }, // correlates every audit entry written during one HTTP request

    success: {
      type: Boolean,
      required: true,
      default: true,
    },
    // when success is false, what went wrong - e.g. a validation or permission error
    // that stopped the action before it completed
    errorMessage: { type: String, default: null },
  },
  { timestamps: false } // `timestamp` above IS the audit timestamp - a separate createdAt/updatedAt would be redundant
);

// compound index for the most common lookup shape: "show me everything that
// happened to this specific entity, most recent first"
AuditLogSchema.index({ "entity.type": 1, "entity.id": 1, timestamp: -1 });
// "show me everything this person did, most recent first"
AuditLogSchema.index({ "actor.id": 1, timestamp: -1 });

export default model("AuditLog", AuditLogSchema);