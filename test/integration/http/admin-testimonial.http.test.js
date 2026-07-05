import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import testimonialRepo from "../../../src/repositories/testimonial.repository.js";

describe("admin testimonial actions (HTTP)", () => {
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

  it("approves a pending testimonial, optionally featuring it", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const testimonial = await testimonialRepo.createTestimonial({
      name: "Milica",
      rating: 5,
      message: "Odlicno iskustvo, toplo preporucujem svima.",
      status: "pending",
    });

    const { token } = await getCsrfToken(agent, `/admin/testimoniali/detalji/${testimonial._id}`);
    const res = await agent
      .put(`/admin/testimoniali/${testimonial._id}/odobri`)
      .type("form")
      .send({ CSRFToken: token, isFeatured: "true" });

    assert.equal(res.status, 302);
    const updated = await testimonialRepo.findTestimonialById(testimonial._id);
    assert.equal(updated.status, "approved");
    assert.equal(updated.isFeatured, true);
  });

  it("rejects a pending testimonial", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const testimonial = await testimonialRepo.createTestimonial({
      name: "Petar",
      rating: 2,
      message: "Nisam bio zadovoljan uslugom nazalost.",
      status: "pending",
    });

    const { token } = await getCsrfToken(agent, `/admin/testimoniali/detalji/${testimonial._id}`);
    const res = await agent.put(`/admin/testimoniali/${testimonial._id}/odbij`).type("form").send({ CSRFToken: token });

    assert.equal(res.status, 302);
    const updated = await testimonialRepo.findTestimonialById(testimonial._id);
    assert.equal(updated.status, "rejected");
  });

  it("deletes a testimonial", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const testimonial = await testimonialRepo.createTestimonial({
      name: "Za Brisanje",
      rating: 4,
      message: "Testimonijal koji ce biti obrisan iz testa.",
      status: "pending",
    });

    const { token } = await getCsrfToken(agent, `/admin/testimoniali/detalji/${testimonial._id}`);
    const res = await agent.delete(`/admin/testimoniali/${testimonial._id}`).set("X-CSRF-Token", token);

    assert.equal(res.status, 302);
    const found = await testimonialRepo.findTestimonialById(testimonial._id);
    assert.equal(found, null);
  });
});