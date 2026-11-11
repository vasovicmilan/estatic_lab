import { describe, it } from "node:test";
import assert from "node:assert/strict";
import wheelPrizeRepo from "../../../src/repositories/wheel-prize.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as wheelService from "../../../src/services/wheel.service.js";
import { id } from "../../helpers/factories.js";

const mk = (over = {}) => ({
  _id: id(), key: `k-${Math.random()}`, label: "Nagrada", shortLabel: "Nagr.", color: "#b08d57", weight: 10, stock: null, awardedCount: 0,
  validDays: 30, order: 0, isActive: true, isFallback: false, discountType: "percentage", discountValue: 10, serviceSlugs: [], includeProducts: false, ...over,
});
const valid = (over = {}) => ({ label: "Besplatan ESMA tretman", shortLabel: "ESMA", discountType: "percentage", discountValue: 100, weight: 5, stock: 3, validDays: 30, serviceSlugs: [], ...over });

function setup(t, prizes) {
  const state = { created: null, updated: null, deleted: null, unset: null };
  t.mock.method(wheelPrizeRepo, "countPrizes", async () => prizes.length);
  t.mock.method(wheelPrizeRepo, "findAllPrizes", async () => prizes);
  t.mock.method(wheelPrizeRepo, "findPrizeById", async (pid) => prizes.find((p) => String(p._id) === String(pid)) || null);
  t.mock.method(wheelPrizeRepo, "createPrize", async (d) => { state.created = d; return { ...d, _id: id() }; });
  t.mock.method(wheelPrizeRepo, "updatePrizeById", async (pid, d) => { state.updated = d; return { ...prizes.find((p) => String(p._id) === String(pid)), ...d }; });
  t.mock.method(wheelPrizeRepo, "deletePrizeById", async (pid) => { state.deleted = String(pid); });
  t.mock.method(wheelPrizeRepo, "unsetFallbackExcept", async (pid) => { state.unset = String(pid); });
  t.mock.method(serviceRepo, "findServiceBySlug", async (slug) => (slug === "teslatone-24" ? { _id: id() } : null));
  return state;
}

describe("wheel prize admin", () => {
  it("slugifies serbian labels", () => {
    assert.equal(wheelService.slugifyPrizeKey("Šišanje i ČAŠA – 10%"), "sisanje-i-casa-10");
  });

  it("creates a prize with generated unique key", async (t) => {
    const existing = [mk({ key: "besplatan-esma-tretman" }), mk(), mk()];
    const st = setup(t, existing);
    const out = await wheelService.createPrize(valid());
    assert.equal(st.created.key, "besplatan-esma-tretman-2");
    assert.equal(st.created.awardedCount, 0);
    assert.ok(out.id);
  });

  it("rejects bad input", async (t) => {
    setup(t, [mk(), mk(), mk()]);
    await assert.rejects(wheelService.createPrize(valid({ shortLabel: "x".repeat(19) })), /18/);
    await assert.rejects(wheelService.createPrize(valid({ discountValue: 150 })), /100/);
    await assert.rejects(wheelService.createPrize(valid({ color: "red" })), /#rrggbb/);
    await assert.rejects(wheelService.createPrize(valid({ serviceSlugs: ["nepostoji"] })), /ne postoji/);
    await assert.rejects(wheelService.createPrize(valid({ isFallback: true })), /Rezervna/);
  });

  it("accepts an existing service slug", async (t) => {
    const st = setup(t, [mk(), mk()]);
    await wheelService.createPrize(valid({ serviceSlugs: ["teslatone-24"] }));
    assert.deepEqual(st.created.serviceSlugs, ["teslatone-24"]);
  });

  it("refuses more than 12 active prizes", async (t) => {
    setup(t, Array.from({ length: 12 }, () => mk()));
    await assert.rejects(wheelService.createPrize(valid()), /najviše 12/);
    // an inactive one is fine
    await wheelService.createPrize(valid({ isActive: false }));
  });

  it("making a prize the fallback unsets the old one", async (t) => {
    const p = mk();
    const st = setup(t, [mk({ isFallback: true }), p, mk()]);
    await wheelService.updatePrizeFull(p._id, valid({ stock: null, isFallback: true }));
    assert.equal(st.unset, String(p._id));
  });

  it("cannot unmark the only fallback directly", async (t) => {
    const f = mk({ isFallback: true });
    setup(t, [f, mk(), mk()]);
    await assert.rejects(wheelService.updatePrizeFull(f._id, valid({ stock: null, isFallback: false })), /rezervna/i);
  });

  it("stock cannot go under awarded count on edit", async (t) => {
    const p = mk({ awardedCount: 5, stock: 10 });
    setup(t, [p, mk(), mk()]);
    await assert.rejects(wheelService.updatePrizeFull(p._id, valid({ stock: 2 })), /podeljenih/);
  });

  it("cannot deactivate below 2 active prizes", async (t) => {
    const p = mk();
    setup(t, [p, mk()]);
    await assert.rejects(wheelService.updatePrizeFull(p._id, valid({ isActive: false })), /bar 2/);
    await assert.rejects(wheelService.updatePrize(p._id, { weight: 1, stock: null, validDays: 30, isActive: false }), /bar 2/);
  });

  it("delete: only unawarded, non-fallback, with enough left", async (t) => {
    const awarded = mk({ awardedCount: 2 });
    const fb = mk({ isFallback: true });
    const plain = mk();
    const st = setup(t, [awarded, fb, plain, mk()]);
    await assert.rejects(wheelService.deletePrize(awarded._id), /isključite/i);
    await assert.rejects(wheelService.deletePrize(fb._id), /Rezervna/);
    await wheelService.deletePrize(plain._id);
    assert.equal(st.deleted, String(plain._id));
  });

  it("delete refuses to leave fewer than 2 active", async (t) => {
    const p = mk();
    setup(t, [p, mk()]);
    await assert.rejects(wheelService.deletePrize(p._id), /bar 2/);
  });

  it("unknown prize is 404", async (t) => {
    setup(t, [mk(), mk()]);
    await assert.rejects(wheelService.getPrizeForEdit(id()), /Nagrada/);
  });
});
