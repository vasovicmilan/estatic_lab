import { Schema, model } from "mongoose";
import { APPOINTMENT_STATUSES } from "./appointment-status-transitions.js";
import PhoneSchema from "./schemas/phone.schema.js";

const AppointmentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    variant: {
      servicePackageId: { type: Schema.Types.ObjectId }, // traces back to Service.packages[]._id
      name: { type: String, required: true },
      duration: { type: Number, required: true }, // minutes
      price: { type: Number, required: true },
    },

    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
      default: null,
    },
    // frozen whenever `employee` is actually set - at booking time if the customer
    // picked someone, or in reassignAppointment if assigned/reassigned later. Same
    // reasoning as contactSnapshot below: the Employee document can later be
    // deleted (see employee.service.js's deleteEmployeeById), but "who performed
    // this" must stay readable in the appointment's own history regardless.
    employeeSnapshot: {
      name: { type: String, default: null },
    },

    // Frozen copy of Service.resources at booking time (see resource.model.js) -
    // every shared physical thing (table/device/room) this specific appointment
    // held simultaneously. A LIST because one appointment can occupy more than
    // one resource pool at once (e.g. an ESMA device AND a table) - see
    // Service.resources for the full reasoning. Each entry snapshots the
    // resource's name for the same reason employeeSnapshot does: the Resource
    // (or Service.resources assignment) can change after the fact, but "what did
    // THIS appointment actually hold" must stay stable, and it lets
    // availability/booking query Appointment directly by resource without a
    // join back through Service on every check.
    resources: [
      {
        resource: { type: Schema.Types.ObjectId, ref: "Resource" },
        name: { type: String, default: null },
      },
    ],

    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "pending",
      index: true,
    },

    // ID of the event this appointment was written to on the assigned employee's
    // Google Calendar (see google-calendar.service.js). Null means either the
    // employee has no googleCalendarId configured, sync is disabled, or the push
    // failed - calendar sync is a side effect of booking, never a blocker for it,
    // so this is intentionally never required.
    googleEventId: {
      type: String,
      default: null,
    },

    rejectedBy: { type: String, enum: ["system", "admin", "employee"] },
    rejectedAt: Date,
    rejectionReason: { type: String, trim: true },

    noShowBy: { type: String, enum: ["admin", "employee"] },
    noShowAt: Date,
    noShowNote: { type: String, trim: true },

    confirmedBy: { type: String, enum: ["system", "admin", "employee"] },
    confirmedAt: Date,

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
      default: null,
    },
    assignedBy: { type: String, enum: ["system", "admin"] },
    assignedAt: Date,

    cancelledBy: { type: String, enum: ["user", "admin"] },
    cancelledAt: Date,
    cancellationReason: { type: String, trim: true },

    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    // mutually exclusive with coupon in practice (a booking either pays in full,
    // minus a coupon, OR is covered by a package - not both), but that's a business
    // rule the service layer enforces, not something encoded at the schema level
    packagePurchase: {
      type: Schema.Types.ObjectId,
      ref: "PackagePurchase",
      default: null,
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
    },

    contactSnapshot: {
      firstName: String,
      lastName: String,
      email: String,
      // encrypted + hashed via PhoneSchema, same as Order/TemporaryOrder/User.phone -
      // see phone.util.js's buildPhoneRecord/decryptPhone. firstName/lastName/email
      // deliberately stay plaintext here, matching Order's contactSnapshot: admin
      // search (appointment.filter.js) does a partial regex match against them, which
      // encrypted ciphertext can't support - only phone gets the full treatment.
      phone: PhoneSchema,
    },
  },
  { timestamps: true }
);

AppointmentSchema.pre("save", function () {
  if (this.isModified("startTime") || this.isModified("variant.duration")) {
    if (this.startTime && this.variant?.duration) {
      this.endTime = new Date(this.startTime.getTime() + this.variant.duration * 60000);
    }
  }
  if (this.isModified("variant.price") || this.isModified("discountApplied") || this.isModified("packagePurchase")) {
    this.finalPrice = this.packagePurchase ? 0 : Math.max(0, (this.variant?.price || 0) - (this.discountApplied || 0));
  }
});

AppointmentSchema.index({ user: 1, startTime: -1 });
AppointmentSchema.index({ employee: 1, startTime: -1 });
AppointmentSchema.index({ assignedTo: 1, startTime: -1 });
AppointmentSchema.index({ status: 1, startTime: 1 });

// Enforces no-double-booking at the database level. The in-code "re-check right
// before the write" guard in appointment.service.js's bookAppointment is NOT
// sufficient on its own: MongoDB transactions use snapshot isolation, so two
// concurrent bookings both read "no conflict" before either commits, and since
// each is inserting a brand-new document (not updating a shared one), MongoDB has
// no natural write-conflict to catch at commit time - both can succeed. A unique
// index is what actually makes the second one fail. Scoped to non-null employee
// and active (pending/confirmed) statuses via a partial filter, so a cancelled/
// rejected/completed appointment at the same slot - or two different unassigned
// appointments before an employee is picked - never collides with this constraint.
// NOTE: this only catches an EXACT startTime collision (the common case: two
// people booking the same visible slot), not every possible staggered-but-
// overlapping pair (e.g. a 90-minute booking at 10:00 and a 30-minute booking at
// 10:30 for the same employee) - that would need a stronger mechanism (a
// per-employee serialization point) if full coverage is ever needed.
AppointmentSchema.index(
  { employee: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { employee: { $type: "objectId" }, status: { $in: ["pending", "confirmed"] } },
  }
);

// Query-perf index for resource-capacity lookups (availability.service.js's
// getResourceBusyIntervalsForDay, appointment.repository.js's
// countOverlappingResourceAppointments). Mongo indexes into "resources.resource"
// across every array element automatically (a multikey index), so a query
// filtering on a single resource id still uses this efficiently even though
// each appointment can hold several. Deliberately NOT unique: unlike the
// employee index above, a resource's capacity can be >1, so more than one
// active appointment is allowed to share (resource, startTime) as long as the
// count stays under that resource's capacity - see appointment.service.js's
// bookAppointment for how capacity is actually checked at write time, and the
// same NOTE above about staggered-overlap races applies here too.
AppointmentSchema.index({ "resources.resource": 1, startTime: 1 });

export default model("Appointment", AppointmentSchema);