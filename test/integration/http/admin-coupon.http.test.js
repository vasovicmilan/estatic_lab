import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";

describe("admin coupon CRUD (HTTP)", () => {
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

  it("creates a coupon, uppercasing the code", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");

    const res = await agent.post("/admin/kuponi").type("form").send({
      CSRFToken: token,
      code: "dobrodosli10",
      discountType: "percentage",
      discountValue: 10,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    assert.equal(res.status, 302);
    const found = await couponRepo.findCouponByCode("DOBRODOSLI10");
    assert.ok(found);
  });

  it("rejects a duplicate coupon code", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: token1 } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");
    await agent.post("/admin/kuponi").type("form").send({
      CSRFToken: token1,
      code: "LETO2026",
      discountType: "percentage",
      discountValue: 10,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { token: token2 } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");
    const res = await agent.post("/admin/kuponi").type("form").send({
      CSRFToken: token2,
      code: "leto2026",
      discountType: "fixed",
      discountValue: 500,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    assert.equal(res.status, 409);
  });

  it("updates a coupon's active status", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");
    await agent.post("/admin/kuponi").type("form").send({
      CSRFToken: createToken,
      code: "ZIMA2026",
      discountType: "percentage",
      discountValue: 15,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const existing = await couponRepo.findCouponByCode("ZIMA2026");
    const { token: editToken } = await getCsrfToken(agent, `/admin/kuponi/izmena/${existing._id}`);

    const res = await agent
      .put(`/admin/kuponi/${existing._id}`)
      .type("form")
      .send({ CSRFToken: editToken, isActive: "false" });

    assert.equal(res.status, 302);
    const updated = await couponRepo.findCouponById(existing._id);
    assert.equal(updated.isActive, false);
  });

  it("deletes a coupon", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");
    await agent.post("/admin/kuponi").type("form").send({
      CSRFToken: createToken,
      code: "BRISANJE2026",
      discountType: "percentage",
      discountValue: 5,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const existing = await couponRepo.findCouponByCode("BRISANJE2026");
    const { token: deleteToken } = await getCsrfToken(agent, "/admin/kuponi/dodavanje");
    const res = await agent.delete(`/admin/kuponi/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await couponRepo.findCouponById(existing._id);
    assert.equal(found, null);
  });
});