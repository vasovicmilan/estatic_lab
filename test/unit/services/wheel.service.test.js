import { describe, it } from "node:test";
import assert from "node:assert/strict";
import wheelPrizeRepo from "../../../src/repositories/wheel-prize.repository.js";
import leadRepo from "../../../src/repositories/lead.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import categoryRepo from "../../../src/repositories/category.repository.js";
import newsLetterService from "../../../src/services/news-letter.service.js";
import eventEmitter from "../../../src/events/event.emitter.js";
import couponService from "../../../src/services/coupon.service.js";
import * as wheelService from "../../../src/services/wheel.service.js";
import { decryptField } from "../../../src/utils/encrypted-field.util.js";
import { id } from "../../helpers/factories.js";

function prize(overrides = {}) {
  return {
    _id: id(),
    key: "popust-10",
    label: "10% popusta",
    shortLabel: "10% popust",
    color: "#b08d57",
    weight: 45,
    stock: null,
    awardedCount: 0,
    isFallback: true,
    isActive: true,
    order: 1,
    discountType: "percentage",
    discountValue: 10,
    maxDiscountAmount: null,
    serviceSlugs: [],
    includeProducts: false,
    validDays: 30,
    ...overrides,
  };
}

const validBody = (o = {}) => ({
  firstName: "Ana",
  lastName: "Anić",
  email: "Ana@Example.com",
  phone: "064 123 4567",
  segment: "usluge",
  consentContact: true,
  consentMarketing: false,
  ...o,
});

// Wires every collaborator with working defaults; each test overrides what it cares about.
function setup(t, { prizes = [prize()], claim, existingLead = null } = {}) {
  const state = { claimed: [], released: [], createdCoupons: [], deletedCoupons: [], leads: [], subscribed: [], events: [] };
  t.mock.method(wheelPrizeRepo, "countPrizes", async () => prizes.length);
  t.mock.method(wheelPrizeRepo, "findAllPrizes", async () => prizes);
  t.mock.method(wheelPrizeRepo, "claimPrize", async (pid) => {
    state.claimed.push(String(pid));
    if (claim) return claim(pid);
    return prizes.find((p) => String(p._id) === String(pid));
  });
  t.mock.method(wheelPrizeRepo, "releasePrize", async (pid) => { state.released.push(String(pid)); });
  t.mock.method(leadRepo, "findLeadByEmailOrPhoneHash", async () => existingLead);
  t.mock.method(leadRepo, "createLead", async (data) => { const lead = { ...data, _id: id() }; state.leads.push(lead); return lead; });
  t.mock.method(couponRepo, "createCoupon", async (data) => { const c = { ...data, _id: id(), usedCount: 0, usageHistory: [] }; state.createdCoupons.push(c); return c; });
  t.mock.method(couponRepo, "deleteCouponById", async (cid) => { state.deletedCoupons.push(String(cid)); });
  t.mock.method(categoryRepo, "findAllCategoriesByDomain", async () => []);
  t.mock.method(leadRepo, "allCouponIds", async () => []);
  t.mock.method(couponRepo, "markCouponsAsWheel", async () => ({ modifiedCount: 0 }));
  t.mock.method(newsLetterService, "subscribe", async (email, interests, origin) => { state.subscribed.push({ email, interests, origin }); });
  t.mock.method(eventEmitter, "emit", (name, payload) => { state.events.push({ name, payload }); return true; });
  return state;
}

describe("wheel.service", () => {
  describe("spin - validation", () => {
    it("requires the consent to be contacted about the prize", async (t) => {
      const s = setup(t);
      await assert.rejects(() => wheelService.spin(validBody({ consentContact: false })), (e) => e.statusCode === 400);
      assert.equal(s.claimed.length, 0, "no prize may be taken before validation passes");
    });

    it("requires all of name, email, phone and a known segment", async (t) => {
      setup(t);
      for (const field of ["firstName", "lastName", "email", "phone", "segment"]) {
        await assert.rejects(() => wheelService.spin(validBody({ [field]: "" })), (e) => e.statusCode === 400, field);
      }
      await assert.rejects(() => wheelService.spin(validBody({ segment: "nesto-drugo" })), (e) => e.statusCode === 400);
    });

    it("refuses a second spin for an email or phone already used - and takes nothing from the stock", async (t) => {
      const s = setup(t, { existingLead: { _id: id() } });
      await assert.rejects(() => wheelService.spin(validBody()), (e) => e.statusCode === 409);
      assert.equal(s.claimed.length, 0);
      assert.equal(s.createdCoupons.length, 0);
    });
  });

  describe("spin - result", () => {
    it("marks the minted coupon as a wheel coupon (kept out of the main coupon list) with its prize key", async (t) => {
      const s = setup(t);
      await wheelService.spin(validBody());
      assert.equal(s.createdCoupons[0].origin, "wheel");
      assert.equal(s.createdCoupons[0].wheelPrizeKey, "popust-10");
    });

    it("returns the prize, a TOCAK- code, the validity date and a 3-9 turn plan", async (t) => {
      const s = setup(t);
      const res = await wheelService.spin(validBody());

      assert.equal(res.prize.key, "popust-10");
      assert.match(res.couponCode, /^TOCAK-[A-Z0-9]{6}$/);
      assert.ok(res.turns >= 3 && res.turns <= 9);
      assert.ok(res.offset >= 0.15 && res.offset <= 0.85);
      const days = (new Date(res.validUntil) - Date.now()) / 86400000;
      assert.ok(days > 29.9 && days <= 30.01, `days=${days}`);
      assert.equal(s.leads.length, 1);
    });

    it("mints a SINGLE-USE coupon (maxUses 1, once per user) with the prize's discount", async (t) => {
      const s = setup(t, { prizes: [prize({ discountValue: 15, key: "popust-15" })] });
      await wheelService.spin(validBody());
      const c = s.createdCoupons[0];
      assert.equal(c.maxUses, 1);
      assert.equal(c.maxUsesPerUser, 1);
      assert.equal(c.discountType, "percentage");
      assert.equal(c.discountValue, 15);
      assert.equal(c.code, s.leads[0].couponCode);
    });

    it("stores name/phone encrypted, email lowercased, and a phone hash for the one-spin check", async (t) => {
      const s = setup(t);
      await wheelService.spin(validBody());
      const lead = s.leads[0];
      assert.equal(lead.email, "ana@example.com");
      assert.notEqual(lead.lastName, "Anić");
      assert.equal(decryptField(lead.lastName), "Anić");
      assert.ok(lead.phone.hash && lead.phone.encrypted);
      assert.ok(!JSON.stringify(lead).includes("0641234567"), "phone must not be stored in plain text");
    });

    it("limits a free-treatment prize to its own service(s) and caps the discount", async (t) => {
      const relaksId = id();
      const free = prize({ key: "besplatna-masaza", label: "Besplatna masaža", discountValue: 100, maxDiscountAmount: 2000, serviceSlugs: ["relaks-masaza"], isFallback: false });
      const s = setup(t, { prizes: [free] });
      t.mock.method(serviceRepo, "findServiceBySlug", async (slug) => (slug === "relaks-masaza" ? { _id: relaksId } : null));
      // the draw lands on the only prize; fallback absent -> the claim itself is what returns it
      await wheelService.spin(validBody());
      const c = s.createdCoupons[0];
      assert.deepEqual(c.applicableServices.map(String), [String(relaksId)]);
      assert.equal(c.discountValue, 100);
      assert.equal(c.maxDiscountAmount, 2000);
    });

    it("never mints an all-services coupon for a one-treatment prize whose service can't be found", async (t) => {
      const free = prize({ key: "besplatan-esma", discountValue: 100, serviceSlugs: ["ne-postoji"], isFallback: false });
      const s = setup(t, { prizes: [free] });
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      await assert.rejects(() => wheelService.spin(validBody()));
      assert.equal(s.createdCoupons.length, 0, "an empty applicableServices would mean 'every service'");
      assert.deepEqual(s.released, [String(free._id)], "the claimed prize goes back to the stock");
      assert.equal(s.leads.length, 0);
    });

    it("excludes apparatus categories from a prize that also covers products, and leaves products off when none exist", async (t) => {
      const apparatus = { _id: id(), name: "Aparati i oprema" };
      const cosmetics = { _id: id(), name: "Kozmetika" };
      const withProducts = prize({ includeProducts: true });

      let s = setup(t, { prizes: [withProducts] });
      t.mock.method(categoryRepo, "findAllCategoriesByDomain", async () => [apparatus, cosmetics]);
      await wheelService.spin(validBody());
      const pd = s.createdCoupons[0].productDiscount;
      assert.ok(pd);
      assert.deepEqual(pd.excludedCategories.map(String), [String(apparatus._id)]);
      assert.equal(pd.discountValue, 10);
    });

    it("leaves the product discount off (not 'all products') when no apparatus category can be identified", async (t) => {
      const s = setup(t, { prizes: [prize({ includeProducts: true })] });
      await wheelService.spin(validBody());
      assert.equal(s.createdCoupons[0].productDiscount, null);
    });
  });

  describe("spin - prize stock", () => {
    it("never draws a prize whose stock is used up, and falls to the next one", async (t) => {
      const gone = prize({ key: "besplatan-esma", weight: 1000, stock: 8, awardedCount: 8, isFallback: false });
      const ten = prize();
      const s = setup(t, { prizes: [gone, ten] });
      const res = await wheelService.spin(validBody());
      assert.equal(res.prize.key, "popust-10");
      assert.ok(!s.claimed.includes(String(gone._id)));
    });

    it("draws again without the prize when someone else just took the last one (lost claim race)", async (t) => {
      const last = prize({ key: "besplatan-neo", weight: 100000, stock: 1, awardedCount: 0, isFallback: false, label: "Neo gratis" });
      const ten = prize({ weight: 1 });
      const s = setup(t, {
        prizes: [last, ten],
        claim: (pid) => (String(pid) === String(last._id) ? null : ten), // the race is lost for `last`
      });
      const res = await wheelService.spin(validBody());
      assert.equal(res.prize.key, "popust-10");
      assert.deepEqual(s.claimed, [String(last._id), String(ten._id)]);
    });

    it("uses the fallback prize when every drawable prize is exhausted", async (t) => {
      const gone = prize({ key: "popust-20", stock: 5, awardedCount: 5, isFallback: false });
      const fallback = prize({ key: "popust-10", isFallback: true, weight: 0 });
      setup(t, { prizes: [gone, fallback] });
      const res = await wheelService.spin(validBody());
      assert.equal(res.prize.key, "popust-10");
    });

    it("tells the visitor to see the staff when even the fallback can't be given", async (t) => {
      const fallback = prize({ isFallback: true, weight: 0 });
      setup(t, { prizes: [fallback], claim: () => null });
      await assert.rejects(() => wheelService.spin(validBody()), (e) => e.statusCode === 409);
    });

    it("follows the configured weights across many spins", async (t) => {
      const a = prize({ key: "a", weight: 80, isFallback: true });
      const b = prize({ key: "b", weight: 20, isFallback: false });
      setup(t, { prizes: [a, b] });
      const counts = { a: 0, b: 0 };
      for (let i = 0; i < 3000; i++) counts[(await wheelService.spin(validBody({ email: `x${i}@e.com` }))).prize.key]++;
      assert.ok(Math.abs(counts.a / 3000 - 0.8) < 0.04, `a=${counts.a / 3000}`);
    });
  });

  describe("spin - failures are rolled back", () => {
    it("gives the prize back and deletes the coupon when saving the lead fails", async (t) => {
      const p = prize();
      const s = setup(t, { prizes: [p] });
      t.mock.method(leadRepo, "createLead", async () => { throw new Error("db down"); });
      await assert.rejects(() => wheelService.spin(validBody()), /db down/);
      assert.deepEqual(s.released, [String(p._id)]);
      assert.equal(s.deletedCoupons.length, 1);
      assert.equal(s.events.filter((e) => e.name === "wheel:won").length, 0);
    });

    it("reports a conflict (and rolls back) when a parallel request with the same email wins the unique index", async (t) => {
      const p = prize();
      const s = setup(t, { prizes: [p] });
      t.mock.method(leadRepo, "createLead", async () => { const e = new Error("dup"); e.code = 11000; e.keyPattern = { email: 1 }; throw e; });
      await assert.rejects(() => wheelService.spin(validBody()), (e) => e.statusCode === 409);
      assert.deepEqual(s.released, [String(p._id)]);
      assert.equal(s.deletedCoupons.length, 1);
    });

    it("retries on a coupon-code collision instead of failing the spin", async (t) => {
      const s = setup(t);
      let calls = 0;
      t.mock.method(couponRepo, "createCoupon", async (data) => {
        calls++;
        if (calls === 1) { const e = new Error("dup"); e.code = 11000; throw e; }
        const c = { ...data, _id: id() };
        s.createdCoupons.push(c);
        return c;
      });
      await wheelService.spin(validBody());
      assert.equal(calls, 2);
    });
  });

  describe("spin - newsletter and notification", () => {
    it("subscribes to the newsletter only with the separate marketing consent, mapping the segment to an interest", async (t) => {
      const s = setup(t);
      await wheelService.spin(validBody({ consentMarketing: false, email: "a@e.com" }));
      assert.equal(s.subscribed.length, 0);
      await wheelService.spin(validBody({ consentMarketing: true, segment: "kozmetika", email: "b@e.com" }));
      assert.deepEqual(s.subscribed, [{ email: "b@e.com", interests: ["products"], origin: { source: "tocak", sourceDetail: "tocak" } }]);
      await wheelService.spin(validBody({ consentMarketing: true, segment: "b2b", email: "c@e.com" }));
      assert.deepEqual(s.subscribed[1].interests, ["partnership"]);
    });

    it("still succeeds when the newsletter signup fails (the lead and prize are already saved)", async (t) => {
      setup(t);
      t.mock.method(newsLetterService, "subscribe", async () => { throw new Error("smtp"); });
      const res = await wheelService.spin(validBody({ consentMarketing: true }));
      assert.ok(res.couponCode);
    });

    it("emits wheel:won with the plain-text details the prize email needs", async (t) => {
      const s = setup(t);
      const res = await wheelService.spin(validBody());
      const ev = s.events.find((e) => e.name === "wheel:won");
      assert.ok(ev);
      assert.equal(ev.payload.email, "ana@example.com");
      assert.equal(ev.payload.couponCode, res.couponCode);
      assert.equal(ev.payload.firstName, "Ana");
    });
  });

  describe("getWheelConfig", () => {
    it("lists only prizes that can still be won and never exposes weights or stock", async (t) => {
      setup(t, {
        prizes: [prize(), prize({ key: "esma", stock: 3, awardedCount: 3, isFallback: false }), prize({ key: "off", isActive: false, isFallback: false })],
      });
      const cfg = await wheelService.getWheelConfig();
      assert.deepEqual(cfg.map((c) => c.key), ["popust-10"]);
      assert.deepEqual(Object.keys(cfg[0]).sort(), ["color", "key", "label", "shortLabel"]);
    });
  });

  describe("updatePrize", () => {
    it("won't set a stock below what was already given out", async (t) => {
      t.mock.method(wheelPrizeRepo, "findPrizeById", async () => prize({ awardedCount: 10, stock: 20, isFallback: false }));
      await assert.rejects(() => wheelService.updatePrize(id(), { weight: 5, stock: 9, validDays: 30, isActive: true }), (e) => e.statusCode === 400);
    });

    it("won't switch off the fallback prize", async (t) => {
      t.mock.method(wheelPrizeRepo, "findPrizeById", async () => prize({ isFallback: true }));
      await assert.rejects(() => wheelService.updatePrize(id(), { weight: 5, stock: null, validDays: 30, isActive: false }), (e) => e.statusCode === 400);
    });

    it("saves valid changes", async (t) => {
      t.mock.method(wheelPrizeRepo, "findPrizeById", async () => prize({ awardedCount: 2, stock: 10, isFallback: false }));
      let saved;
      t.mock.method(wheelPrizeRepo, "updatePrizeById", async (pid, data) => { saved = data; return {}; });
      await wheelService.updatePrize(id(), { weight: 7, stock: 12, validDays: 14, isActive: true });
      assert.deepEqual(saved, { weight: 7, stock: 12, validDays: 14, isActive: true });
    });
  });

  describe("the minted coupon works with the real coupon rules", () => {
    async function mint(t, p, services = []) {
      const s = setup(t, { prizes: [p] });
      t.mock.method(serviceRepo, "findServiceBySlug", async (slug) => services.find((x) => x.slug === slug) || null);
      await wheelService.spin(validBody());
      const coupon = s.createdCoupons[0];
      t.mock.method(couponRepo, "findCouponByCode", async () => coupon);
      return coupon;
    }

    it("a free-massage coupon covers the massage fully, but only that service", async (t) => {
      const relaks = { _id: id(), slug: "relaks-masaza" };
      const other = id();
      await mint(t, prize({ key: "m", discountValue: 100, maxDiscountAmount: 2000, serviceSlugs: ["relaks-masaza"], isFallback: false }), [relaks]);

      const ok = await couponService.validateCouponForBooking("X", { serviceId: relaks._id, appointmentValue: 2000 });
      assert.equal(ok.discountAmount, 2000);
      await assert.rejects(() => couponService.validateCouponForBooking("X", { serviceId: other, appointmentValue: 2000 }), (e) => e.statusCode === 400);
    });

    it("the 100% cap stops a longer/pricier variant from becoming free", async (t) => {
      const relaks = { _id: id(), slug: "relaks-masaza" };
      await mint(t, prize({ key: "m", discountValue: 100, maxDiscountAmount: 2000, serviceSlugs: ["relaks-masaza"], isFallback: false }), [relaks]);
      const res = await couponService.validateCouponForBooking("X", { serviceId: relaks._id, appointmentValue: 3000 });
      assert.equal(res.discountAmount, 2000);
    });

    it("a 15% coupon works on any service", async (t) => {
      await mint(t, prize({ discountValue: 15 }));
      const res = await couponService.validateCouponForBooking("X", { serviceId: id(), appointmentValue: 4000 });
      assert.equal(res.discountAmount, 600);
    });

    it("cannot be used a second time anywhere once it has been redeemed", async (t) => {
      const coupon = await mint(t, prize());
      coupon.usedCount = 1; // the redeem step incremented it
      await assert.rejects(() => couponService.validateCouponForBooking("X", { serviceId: id(), appointmentValue: 3000 }), (e) => e.statusCode === 400);
    });

    it("is not valid after its expiry date", async (t) => {
      const coupon = await mint(t, prize());
      coupon.validUntil = new Date(Date.now() - 1000);
      await assert.rejects(() => couponService.validateCouponForBooking("X", { serviceId: id(), appointmentValue: 3000 }), (e) => e.statusCode === 400);
    });
  });
});
