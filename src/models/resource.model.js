import { Schema, model } from "mongoose";

/**
 * A Resource is a shared physical thing a booking needs besides an employee's
 * time - a massage table, an ESMA device, a treatment room. Two different
 * employees can each individually be "free" at 14:00 and still not both be able
 * to deliver an ESMA-tied service at 14:00, because there's only one ESMA
 * device between them. Employee.workingHours/Appointment already model "is this
 * PERSON free"; this model exists to also answer "is the THING they need free" -
 * see Service.resource, Appointment.resource, and availability.service.js's
 * capacity filtering for how the two checks combine.
 *
 * capacity is how many concurrent appointments this resource can support (e.g.
 * 2 if there are two identical massage tables). Today every resource in this
 * business has capacity 1, but the field is deliberately a number, not a
 * boolean, so adding a second table later is a data change, not a schema
 * change.
 */
const ResourceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Lets an admin take a resource out of service (broken device, room under
    // renovation) without deleting it and losing the historical link from past
    // appointments. Treated as capacity 0 everywhere booking/availability
    // reads capacity - see resource.service.js's getEffectiveCapacity.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default model("Resource", ResourceSchema);