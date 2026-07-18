import { Schema, model } from "mongoose";

export const RESERVED_ROLE_NAMES = ["admin", "employee", "user"];

export const PERMISSIONS = [
  "access_admin_panel",
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
  "manage_products",
  "manage_orders",
  "view_dashboard",
];

const RoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z][a-z0-9 _-]{1,49}$/,
        "Naziv role mora počinjati slovom i sadržati samo mala slova, brojeve, razmake, crtice ili donje crte (2-50 karaktera).",
      ],
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