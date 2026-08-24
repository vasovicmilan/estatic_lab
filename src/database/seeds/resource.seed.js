import mongoose from "mongoose";
import Resource from "../../models/resource.model.js";
import { logInfo } from "../../utils/logger.util.js";

// Deployment data, not test fixtures (see docs) - the studio's physical
// stations. IDs are pinned explicitly (not auto-generated) because
// esma-catalog.seed.js's SERVICE_RESOURCE_MAP and the standalone
// backfill-service-resources.js migration both reference these same two IDs
// directly - keeping them fixed here is what lets those other scripts stay in
// sync without a slug-lookup indirection.
//
// "Sto za ESMA i uređaje" is deliberately named for the SPACE, not the
// current device - it's the shared table/room capacity that the ESMA Favorit
// occupies today, and that any future device placed in the same spot will
// also compete for. If a future device gets its own separate table instead of
// sharing this one, give IT its own new Resource - don't repurpose this one.
export const RESOURCE_MASSAGE_TABLE_ID = "6a6dcb1675497c5b2c3653fa";
export const RESOURCE_ESMA_TABLE_ID = "6a6dcb1675497c5b2c3653fb";

const defaultResources = [
  {
    _id: RESOURCE_MASSAGE_TABLE_ID,
    name: "Sto za masažu",
    capacity: 1,
    isActive: true,
    notes: "Fizički sto koji koriste sve usluge ručne masaže, bez obzira koji zaposleni izvodi termin.",
  },
  {
    _id: RESOURCE_ESMA_TABLE_ID,
    name: "Sto za ESMA i uređaje",
    capacity: 1,
    isActive: true,
    notes: "Deljeni fizički prostor/sto koji koristi ESMA Favorit danas, i koji će deliti i budući uređaji postavljeni na isto mesto - ako neki budući uređaj dobije SVOJ zaseban sto, njemu treba nov, poseban Resource, ne ovaj.",
  },
];

export async function seedResources() {
  const results = [];

  for (const resourceData of defaultResources) {
    // upsert by _id, not name: if you already created this resource by hand
    // through /admin/resursi with these exact IDs, $setOnInsert means this
    // touches nothing - your capacity/isActive/name edits are preserved. It
    // only writes the default values the very first time this ID is seen.
    const { _id, ...rest } = resourceData;
    const resource = await Resource.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $setOnInsert: rest },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    results.push(resource);
  }

  logInfo("Resources seeded", { count: results.length, resources: results.map((r) => ({ id: r._id.toString(), name: r.name })) });
  return results;
}

export default seedResources;