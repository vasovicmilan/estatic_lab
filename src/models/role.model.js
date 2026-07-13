import { Schema, model } from "mongoose";

/**
 * Roles are a closed set on purpose — estatic_lab has exactly three kinds of actor
 * (admin, employee, user). Guests are not a role: an unauthenticated booking creates
 * a real User with status "guest" (see user.model.js) rather than a separate identity.
 *
 * `permissions` is deliberately an enum too, so a typo in a permission string fails
 * at the schema level instead of silently never matching an `admin.middleware.js` check.
 */
export const RESERVED_ROLE_NAMES = ["admin", "employee", "user"];

export const PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "manage_employees",
  "manage_services",
  "manage_packages",
  "manage_taxonomy", // categories & tags
  "manage_blog",
  "manage_appointments_all", // see/act on every appointment
  "manage_appointments_assigned", // employee: only appointments assigned to them
  "manage_own_appointments", // user: only their own appointments
  "manage_marketing", // contact, newsletter, testimonials
  "manage_coupons",
  "view_dashboard",
];

const RoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: RESERVED_ROLE_NAMES,
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

    // used by user.service.js to pick a role when none is specified at registration
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
