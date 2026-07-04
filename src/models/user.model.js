import { Schema, model } from "mongoose";

/**
 * The single identity model for estatic_lab — no separate Customer/User split like the
 * e-commerce reference. A "guest" booking (no account, not logged in) still produces a
 * real User document with status "guest": no password, a resetToken doubling as a
 * "claim your account" link. If a User with the given email already exists at booking
 * time, the appointment attaches to that User instead of creating a new one.
 * See services/user.service.js `findOrCreateGuestUser` and services/appointment.service.js
 * for how this is used inside the booking transaction.
 */
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

    // absent for pure-Google users and for guest users who haven't claimed their account yet
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

    // needed at booking/contact time; not required at the schema level since a Google
    // signup won't have it yet — enforced by the service layer when it's actually needed
    phone: {
      type: String,
      trim: true,
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

    // "guest": created automatically during an unauthenticated booking, no password set yet.
    // "pending": registered locally, hasn't confirmed their email yet.
    // "active": normal usable account.
    // "inactive" / "suspended": deactivated by self or by an admin.
    status: {
      type: String,
      enum: ["guest", "pending", "active", "inactive", "suspended"],
      default: "pending",
      required: true,
      index: true,
    },

    // doubles as the "claim your guest account" token when status === "guest"
    resetToken: String,
    resetTokenExpiration: Date,

    confirmToken: String,
    confirmTokenExpiration: Date,

    acceptance: { type: Boolean, default: true, required: true },
    confirmed: { type: Boolean, default: false },
    lastLogin: Date,
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ lastLogin: -1 });

export default model("User", UserSchema);
