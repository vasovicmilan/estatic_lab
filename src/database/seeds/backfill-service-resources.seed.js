import Service from "../../models/service.model.js";
import { RESOURCE_MASSAGE_TABLE_ID, RESOURCE_ESMA_TABLE_ID } from "./resource.seed.js";
import { logInfo } from "../../utils/logger.util.js";

/**
 * Targeted, minimal backfill for the 10 services that already exist in
 * production (see zaclaudenovo_services.json export, checked against this
 * list on 2026-08-01). Deliberately does NOT go through esma-catalog.seed.js's
 * full upsertServices() - that re-sets name/description/features/packages/etc.
 * on every run, which risks clobbering any manual edits made via /admin/usluge
 * since the catalog was last seeded. This touches ONLY the `resources` field,
 * via $set on each service by slug, and nothing else.
 *
 * Run once with: node src/database/seeds/run-backfill-service-resources.js
 * Run resource.seed.js FIRST (or create the two resources by hand via
 * /admin/resursi with these same two IDs) so /admin/usluge shows real names
 * instead of a dangling reference.
 *
 * Classification (device vs hands-on): every "ESMA Favorit" treatment needs
 * the shared ESMA table/room; every hand massage needs the massage table.
 * If you add a new service later, assign its resources through the
 * /admin/usluge edit form instead of extending this list - this file is a
 * one-time backfill for what already existed before the resource-capacity
 * feature shipped, not an ongoing source of truth.
 */
const ESMA_TABLE_SERVICE_SLUGS = [
  "teslatone-24",
  "aquadrain-360",
  "lipolise-russianmax",
  "triactive-celluerase",
  "lasersonic-face-sculpt",
  "medicinski-bioreset",
];

const MASSAGE_TABLE_SERVICE_SLUGS = [
  "relaks-masaza",
  "sportska-masaza",
  "terapeutska-masaza",
  "anticelulit-masaza",
];

async function assignResource(slugs, resourceId) {
  const results = [];
  for (const slug of slugs) {
    const updated = await Service.findOneAndUpdate(
      { slug },
      { $set: { resources: [resourceId] } },
      { new: true }
    );
    if (!updated) {
      logInfo("backfill-service-resources: slug not found, skipped", { slug });
      continue;
    }
    results.push({ slug, name: updated.name, resources: updated.resources.map((r) => r.toString()) });
  }
  return results;
}

export async function backfillServiceResources() {
  const esmaResults = await assignResource(ESMA_TABLE_SERVICE_SLUGS, RESOURCE_ESMA_TABLE_ID);
  const massageResults = await assignResource(MASSAGE_TABLE_SERVICE_SLUGS, RESOURCE_MASSAGE_TABLE_ID);

  const all = [...esmaResults, ...massageResults];
  logInfo("Service resources backfilled", { count: all.length, services: all.map((s) => s.name) });
  return all;
}

export default backfillServiceResources;