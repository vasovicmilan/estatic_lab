import { Schema, model } from "mongoose";

// Jedan "točak sreće" (jedna nagradna igra): svaki ima svoj link /tocak/:slug i QR, svoje nagrade i
// svoje kontakte. Točak sa slugom "tocak" je podrazumevani (otvara se na /tocak) - na njega
// su preseljeni svi podaci koji su postojali pre uvođenja više točkova.
export const DEFAULT_WHEEL_SLUG = "tocak";
// /tocak/vrti je POST adresa za vrtenje, ne sme da bude slug
export const RESERVED_WHEEL_SLUGS = ["vrti"];

const WheelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,60}$/ },
    // naslov i uvodni tekst na javnoj strani (prazno = podrazumevani tekst)
    title: { type: String, trim: true, maxlength: 120, default: "" },
    intro: { type: String, trim: true, maxlength: 300, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    // opciono trajanje igre; van tog perioda javna strana kaže da igra nije aktivna
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model("Wheel", WheelSchema);
