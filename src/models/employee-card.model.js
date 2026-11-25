import { Schema, model } from "mongoose";
import ImageSchema from "./schemas/image.schema.js";

/**
 * Virtuelna vizitka zaposlenog (javna strana /vizitka/:slug, QR kod, vCard) - DODATAK uz Employee,
 * ne zamena za Expert. Slika se samo JEDNOM kopira sa povezanog Expert profila (kopija fajla,
 * nema trajne veze), a sve lične informacije su podrazumevano skrivene: javno su uvek samo
 * ime, titula i slika, a ostalo zaposleni sam štikulira (`show`).
 *
 * `slug` je ono što piše u QR kodu - novi slug poništava stare odštampane QR kodove, zato se
 * menja samo svesnom akcijom ("Novi link").
 */
const EmployeeCardSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // zaposleni uključuje/isključuje javnost; admin može nezavisno da je blokira
    isPublic: { type: Boolean, default: false, index: true },
    adminDisabled: { type: Boolean, default: false, index: true },

    displayName: { type: String, trim: true, maxlength: 80 },
    title: { type: String, trim: true, maxlength: 80 },
    photo: { type: ImageSchema, default: undefined },
    bio: { type: String, trim: true, maxlength: 300 },

    instagram: { type: String, trim: true, maxlength: 200 },
    facebook: { type: String, trim: true, maxlength: 200 },
    website: { type: String, trim: true, maxlength: 200 },

    show: {
      phone: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      bio: { type: Boolean, default: false },
      instagram: { type: Boolean, default: false },
      facebook: { type: Boolean, default: false },
      website: { type: Boolean, default: false },
      services: { type: Boolean, default: false },
      products: { type: Boolean, default: false },
    },

    // kategorije čije usluge se prikazuju (samo one u kojima zaposleni stvarno radi) + do 3 izdvojene usluge
    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    pinnedServices: [{ type: Schema.Types.ObjectId, ref: "Service" }],

    // izdvojeni artikli iz prodavnice (do 6) - za zaposlene koji promovišu aparate/proizvode, ne usluge
    pinnedProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],

    // opcioni materijal (brošura) kao dugme za preuzimanje
    material: { type: Schema.Types.ObjectId, ref: "Material", default: null },

    viewCount: { type: Number, default: 0 },
    contactDownloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model("EmployeeCard", EmployeeCardSchema);
