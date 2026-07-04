import { Schema, model } from "mongoose";

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

    status: {
      type: String,
      enum: ["guest", "pending", "active", "inactive", "suspended"],
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
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });
UserSchema.index({ lastLogin: -1 });

export default model("User", UserSchema);
