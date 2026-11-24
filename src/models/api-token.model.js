import { Schema, model } from "mongoose";

// Oblasti koje token sme da dodirne. Ovo je SUŽAVANJE dozvola role (presek), nikad proširenje:
// token ne može da uradi ništa što njegova rola ne dozvoljava, a ovde se još bira šta od toga.
export const TOKEN_SCOPES = ["blog", "catalog", "materials"];

export const TOKEN_MIN_DAYS = 1;
export const TOKEN_MAX_DAYS = 90;

// Token pripada običnom korisničkom nalogu (npr. "Claude asistent") sa sopstvenom rolom. Zato su
// autor postova, akter u dnevniku revizije i suspenzija naloga već rešeni postojećim mehanizmima.
// Sama tajna se NIKAD ne čuva: samo SHA-256 hash i prvih nekoliko znakova radi prepoznavanja u listi.
const ApiTokenSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    scopes: [{ type: String, enum: TOKEN_SCOPES }],
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ApiTokenSchema.index({ revokedAt: 1, expiresAt: 1 });

export default model("ApiToken", ApiTokenSchema);
