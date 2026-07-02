import { Schema, model } from "mongoose";

export const ROLE_NAMES = ["admin", "employee", "user"];

export const PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "manage_employees",
  "manage_services",
  "manage_packages",
  "manage_taxonomy",
  "manage_blog",
  "manage_appointments_all",
  "manage_appointments_assigned",
  "manage_own_appointments",
  "manage_marketing",
  "manage_coupons",
  "view_dashboard",
];

const RoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ROLE_NAMES,
    },

    description: {
      type: String,
      trim: true,
    },

    permissions: [
      {
        type: String,
        enum: PERMISSIONS,
      },
    ],

    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default model("Role", RoleSchema);