import { Schema, model } from "mongoose";
import PhoneSchema from "./schemas/phone.schema.js";
import AddressSchema from "./schemas/address.schema.js";
import CartItemSchema from "./schemas/cart-item.schema.js";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email format is invalid"],
    },

    password: {
      type: String,
      minlength: 8,
      select: false,
    },

    firstName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },

    phone: PhoneSchema,

    addresses: {
      type: [AddressSchema],
      default: [],
    },

    // guest carts live in the session (see cart.service.js) until login/checkout, at
    // which point they're merged into this array - see mergeGuestCart. Deliberately
    // holds only {product, variant, quantity}, never a title/price/image snapshot -
    // the cart always reflects the product's current price and stock, not what it
    // was when the item was added.
    cart: {
      type: [CartItemSchema],
      default: [],
    },

    // Touched (repositories/user.repository.js) on every cart mutation - add,
    // quantity change, remove, or a guest cart merged in at login. Together
    // with cartReminderStage below, this is what cart-reminder-jobs.js uses to
    // find carts that have sat untouched long enough to count as abandoned,
    // without needing a separate collection just to track cart activity.
    cartUpdatedAt: {
      type: Date,
      default: null,
    },
    // 0 = no reminder sent since the cart was last touched, 1 = the plain
    // "you left items in your cart" reminder went out, 2 = the one-time
    // discount follow-up went out. Reset to 0 whenever the cart is touched
    // again (a fresh abandonment "episode" starts over) - see
    // cart-reminder.config.js for the exact wait windows per stage.
    cartReminderStage: {
      type: Number,
      default: 0,
      enum: [0, 1, 2],
    },
    // When the CURRENT stage was sent - informational, not used to gate
    // anything (cartUpdatedAt + cartReminderStage already fully determine
    // what's due next).
    cartReminderSentAt: {
      type: Date,
      default: null,
    },
    // Separate from cartReminderStage on purpose: this does NOT reset when the
    // cart is touched again, so it survives across multiple abandon/refill
    // cycles. cart-reminder-jobs.js won't send a new discount offer while this
    // is within CART_DISCOUNT_COOLDOWN_DAYS, even if the person abandons a
    // brand new cart in the meantime - the coupon's own maxUsesPerUser already
    // stops them from redeeming it twice, but without this a persistent
    // abandoner would still get a fresh "here's a discount" email every few
    // days, which is just spam once they've already been offered it once.
    cartDiscountOfferedAt: {
      type: Date,
      default: null,
    },

    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    avatar: {
      type: String,
      default: "",
    },

    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    status: {
      type: String,
      // "deleted" = anonymized via user.service.js's anonymizeUser - the account
      // requested erasure, PII is scrubbed, but the document/ObjectId is kept so
      // every historical Order/Appointment/PackagePurchase reference stays valid.
      // Deliberately distinct from "suspended" (banned for cause by admin) and
      // "inactive" (self-paused via deactivateAccount, PII untouched, reversible).
      enum: ["guest", "pending", "active", "inactive", "suspended", "deleted"],
      default: "pending",
      required: true,
      index: true,
    },

    resetToken: String,
    resetTokenExpiration: Date,

    confirmToken: String,
    confirmTokenExpiration: Date,

    acceptance: { type: Boolean, default: true, required: true },
    confirmed: { type: Boolean, default: false },
    lastLogin: Date,

    // Server-side JWT revocation. apiAuthMiddleware/optionalApiAuth verify the
    // token's signature and expiry with jwt.verify (see crypto.service.js), which
    // says nothing about whether the account has since been suspended/deactivated
    // - a token issued before that happened would otherwise keep passing auth
    // until it naturally expires. Bumped to "now" whenever the account moves to
    // "inactive"/"suspended" (user.service.js's deactivateAccount/updateUserStatus)
    // so the middleware can reject any previously-issued token whose `iat` predates
    // it, even though its signature is still valid. Deliberately NOT touched when
    // the account is reactivated back to "active" - that would otherwise
    // instantly invalidate the very tokens reactivation is supposed to restore
    // access for; a reactivated user's old (pre-suspension) token stays revoked
    // and they simply log in again, which is expected.
    tokenValidAfter: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });
UserSchema.index({ lastLogin: -1 });

export default model("User", UserSchema);