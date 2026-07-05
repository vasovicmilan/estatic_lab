import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import contactRepo from "../../../src/repositories/contact.repository.js";

describe("admin contact message actions (HTTP)", () => {
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

  it("marks a 'new' message as read automatically when viewed", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const contact = await contactRepo.createContact({
      firstName: "Jovana",
      lastName: "Jovanovic",
      email: "jovana@example.com",
      message: "Zdravo, zanima me vise o vasim uslugama.",
      consent: true,
      status: "new",
    });

    const res = await agent.get(`/admin/kontakt/detalji/${contact._id}`);

    assert.equal(res.status, 200);
    const updated = await contactRepo.findContactById(contact._id);
    assert.equal(updated.status, "read");
  });

  it("updates a message's status explicitly", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const contact = await contactRepo.createContact({
      firstName: "Petar",
      lastName: "Petrovic",
      email: "petar@example.com",
      message: "Imam pitanje o zakazivanju termina.",
      consent: true,
      status: "new",
    });

    const { token } = await getCsrfToken(agent, `/admin/kontakt/detalji/${contact._id}`);
    const res = await agent
      .put(`/admin/kontakt/${contact._id}/status`)
      .type("form")
      .send({ CSRFToken: token, status: "replied" });

    assert.equal(res.status, 302);
    const updated = await contactRepo.findContactById(contact._id);
    assert.equal(updated.status, "replied");
  });
});