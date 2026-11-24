import { Schema, model } from "mongoose";

// Jedan dokument ("singleton"): prekidač koji odmah blokira SVE API tokene, bez opoziva svakog
// pojedinačno. Uključuje se i isključuje u /admin/api-tokeni; tokeni ostaju sačuvani.
const ApiAccessStateSchema = new Schema(
  {
    key: { type: String, default: "singleton", unique: true },
    paused: { type: Boolean, default: false },
    pausedAt: { type: Date, default: null },
    pausedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default model("ApiAccessState", ApiAccessStateSchema);
