import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import partnerRepo from "../../../src/repositories/partner.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";

/**
 * HTTP-level coverage for the admin partner CRUD flow - never exercised through
 * the real form/validator/controller/service chain before this test existed
 * (partner.controller.js sat at 0% function coverage even after today's
 * commissionRateServices/commissionRateProducts + per-source cap redesign).
 * Mirrors admin-coupon.http.test.js's structure.
 */
describe("admin partner CRUD (HTTP)", () => {
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

  it("creates a partner with independent services/products rates and caps", async () => {
    await ensureRole("partner");
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    // a plain customer account is who gets promoted to partner - a throwaway
    // agent just to get a real User document to reference, same as
    // registerAndLogin's own beforeLogin hook pattern
    const target = await registerAndLogin(request.agent(app), { email: "buducipartner@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    const res = await agent.post("/admin/partneri").type("form").send({
      CSRFToken: token,
      userId: target._id.toString(),
      commissionRateServices: 12,
      commissionRateProducts: 4,
      maxCommissionAmountServices: 5000,
      maxCommissionAmountProducts: 20000,
    });

    assert.equal(res.status, 302);
    const found = await partnerRepo.findPartnerByUserId(target._id);
    assert.ok(found);
    assert.equal(found.commissionRateServices, 12);
    assert.equal(found.commissionRateProducts, 4);
    assert.equal(found.maxCommissionAmountServices, 5000);
    assert.equal(found.maxCommissionAmountProducts, 20000);
  });

  it("promotes the target user to the 'partner' role", async () => {
    await ensureRole("partner");
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "buducipartner2@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    await agent.post("/admin/partneri").type("form").send({
      CSRFToken: token,
      userId: target._id.toString(),
      commissionRateServices: 10,
      commissionRateProducts: 5,
    });

    const updatedUser = await userRepo.findUserById(target._id, { populateFields: ["role"] });
    assert.equal(updatedUser.role.name, "partner");
  });

  it("rejects an out-of-range commission rate", async () => {
    await ensureRole("partner");
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "nevalidan@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    const res = await agent.post("/admin/partneri").type("form").send({
      CSRFToken: token,
      userId: target._id.toString(),
      commissionRateServices: 150, // out of 0-100 range
      commissionRateProducts: 5,
    });

    assert.equal(res.status, 400);
    const found = await partnerRepo.findPartnerByUserId(target._id);
    assert.equal(found, null);
  });

  it("updates a partner's rates independently, leaving the other bucket untouched", async () => {
    await ensureRole("partner");
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "izmenapartner@example.com", roleName: "user" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    await agent.post("/admin/partneri").type("form").send({
      CSRFToken: createToken,
      userId: target._id.toString(),
      commissionRateServices: 10,
      commissionRateProducts: 5,
    });

    const existing = await partnerRepo.findPartnerByUserId(target._id);
    const { token: editToken } = await getCsrfToken(agent, `/admin/partneri/izmena/${existing._id}`);

    const res = await agent
      .put(`/admin/partneri/${existing._id}`)
      .type("form")
      .send({ CSRFToken: editToken, commissionRateServices: 20 });

    assert.equal(res.status, 302);
    const updated = await partnerRepo.findPartnerById(existing._id);
    assert.equal(updated.commissionRateServices, 20);
    assert.equal(updated.commissionRateProducts, 5); // untouched by the partial update
  });

  it("deletes a partner", async () => {
    await ensureRole("partner");
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "brisanjepartner@example.com", roleName: "user" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    await agent.post("/admin/partneri").type("form").send({
      CSRFToken: createToken,
      userId: target._id.toString(),
      commissionRateServices: 10,
      commissionRateProducts: 5,
    });

    const existing = await partnerRepo.findPartnerByUserId(target._id);
    const { token: deleteToken } = await getCsrfToken(agent, "/admin/partneri/dodavanje");
    const res = await agent.delete(`/admin/partneri/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await partnerRepo.findPartnerById(existing._id);
    assert.equal(found, null);
  });
});