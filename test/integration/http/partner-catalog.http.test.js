import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import partnerRepo from "../../../src/repositories/partner.repository.js";
import productRepo from "../../../src/repositories/product.repository.js";
import { buildProduct } from "../../helpers/factories.js";

/**
 * HTTP-level coverage for partner-account.controller.js's catalog() - never
 * exercised through the real route/controller chain before this test existed.
 * Focused specifically on the artikli-visibility bug fix: a partner's coupon
 * without a productDiscount used to still show a full, clickable "Proizvodi"
 * section with referral links that silently applied no discount at checkout -
 * these tests prove that's gone, through the real HTTP response, not a mock.
 */
describe("partner catalog - artikli only shown when the coupon actually covers them (HTTP)", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // Promotes a throwaway user to partner via the real admin flow (same
  // pattern admin-partner.http.test.js already established), then logs in as
  // that exact user on a fresh agent - registerAndLogin's own throwaway
  // registration + the standard "lozinka123" password it always uses, no
  // second registration needed.
  async function loginAsNewPartner(adminAgent, email) {
    const target = await registerAndLogin(request.agent(app), { email, roleName: "user" });
    const { token } = await getCsrfToken(adminAgent, "/admin/partneri/dodavanje");
    await adminAgent.post("/admin/partneri").type("form").send({
      CSRFToken: token,
      userId: target._id.toString(),
      commissionRateServices: 10,
      commissionRateProducts: 5,
    });
    const partner = await partnerRepo.findPartnerByUserId(target._id);

    const partnerAgent = request.agent(app);
    const { token: loginToken } = await getCsrfToken(partnerAgent, "/prijava");
    await partnerAgent.post("/prijava").type("form").send({ email, password: "lozinka123", CSRFToken: loginToken });

    return { partnerAgent, partner };
  }

  it("hides the Proizvodi section (with an explanatory note) when the partner's coupon has no productDiscount", async () => {
    await ensureRole("partner");
    const adminAgent = request.agent(app);
    await registerAndLogin(adminAgent, { email: "admin@example.com", roleName: "admin" });

    const { partnerAgent, partner } = await loginAsNewPartner(adminAgent, "partner-bez-artikala@example.com");

    await couponRepo.createCoupon({
      code: "SAMOUSLUGE10",
      discountType: "percentage",
      discountValue: 10,
      partner: partner._id,
      productDiscount: null, // explicit - this is the case being tested
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    // a real product must exist so this test actually proves the link is
    // correctly withheld because of the missing productDiscount - not just
    // trivially passing because there was nothing to link to in the first place
    await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));

    const res = await partnerAgent.get("/moj-partner-nalog/katalog");

    assert.equal(res.status, 200);
    assert.ok(res.text.includes("ne uključuje popust na artikle"), "should explain why there's no product links, not just omit them silently");
    assert.ok(!res.text.includes("/prodavnica/"), "no product referral link should be present when productDiscount is absent");
  });

  it("shows real, working product referral links when the partner's coupon does have a productDiscount", async () => {
    await ensureRole("partner");
    const adminAgent = request.agent(app);
    await registerAndLogin(adminAgent, { email: "admin2@example.com", roleName: "admin" });

    const { partnerAgent, partner } = await loginAsNewPartner(adminAgent, "partner-sa-artiklima@example.com");

    await couponRepo.createCoupon({
      code: "IARTIKLI10",
      discountType: "percentage",
      discountValue: 10,
      partner: partner._id,
      productDiscount: { discountType: "fixed", discountValue: 300, applicableProducts: [] },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));

    const res = await partnerAgent.get("/moj-partner-nalog/katalog");

    assert.equal(res.status, 200);
    assert.ok(!res.text.includes("ne uključuje popust na artikle"), "the explanatory note should NOT show once a productDiscount exists");
    assert.ok(res.text.includes("code=IARTIKLI10"), "product links should use the coupon that actually covers artikli");
  });
});
