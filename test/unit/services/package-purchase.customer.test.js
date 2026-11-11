import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import * as svc from "../../../src/services/package-purchase.service.js";
import { buildPackagePurchase, id } from "../../helpers/factories.js";

describe("package-purchase.service - customer view", () => {
  it("lists only what findPurchasesByUser returns and filters by shown status", async (t) => {
    const uid = id();
    const active = buildPackagePurchase({ user: uid });
    const expired = buildPackagePurchase({ user: uid, expiresAt: new Date(Date.now() - 86400000) });
    const done = buildPackagePurchase({ user: uid, status: "completed" });
    t.mock.method(packagePurchaseRepo, "findPurchasesByUser", async () => [active, expired, done]);
    assert.equal((await svc.listMyPurchases(uid)).length, 3);
    const onlyExpired = await svc.listMyPurchases(uid, { status: "expired" });
    assert.equal(onlyExpired.length, 1);
    assert.equal(onlyExpired[0].id, String(expired._id));
    assert.equal((await svc.listMyPurchases(uid, { status: "active" })).length, 1);
  });

  it("someone else's package is a 404, not a leak", async (t) => {
    const p = buildPackagePurchase({ user: id() });
    t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => p);
    await assert.rejects(svc.getMyPurchase(id(), p._id), /Kupljeni paket/);
  });

  it("detail includes the appointments booked from the package", async (t) => {
    const uid = id();
    const p = buildPackagePurchase({ user: uid });
    t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => p);
    let seenFilter;
    t.mock.method(appointmentRepo, "findAppointments", async (opts) => {
      seenFilter = opts.filters;
      return { data: [{ _id: id(), startTime: new Date(), status: "completed", service: { name: "ESMA" }, packagePurchase: p._id, finalPrice: 0 }] };
    });
    const out = await svc.getMyPurchase(uid, p._id);
    assert.equal(String(seenFilter.packagePurchaseId), String(p._id));
    assert.equal(out.termini.length, 1);
  });
});
