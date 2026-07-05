import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import contactRepo from "../../../src/repositories/contact.repository.js";

describe("public contact form (HTTP)", () => {
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

  describe("GET /kontakt", () => {
    it("renders the contact page with the form", async () => {
      const res = await request(app).get("/kontakt");
      assert.equal(res.status, 200);
      assert.match(res.text, /action="\/kontakt"/);
    });
  });

  describe("POST /kontakt", () => {
    it("submits a valid contact message and redirects back with a success flash", async () => {
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/kontakt");

      const res = await agent.post("/kontakt").type("form").send({
        CSRFToken: token,
        firstName: "Jovana",
        lastName: "Jovanovic",
        email: "jovana@example.com",
        message: "Zdravo, zanima me vise o vasim uslugama masaze.",
        consent: "true",
      });

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, "/kontakt");

      const result = await contactRepo.findContacts({});
      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].email, "jovana@example.com");
    });

    it("rejects a submission without consent and re-renders the form with a 400", async () => {
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/kontakt");

      const res = await agent.post("/kontakt").type("form").send({
        CSRFToken: token,
        firstName: "Jovana",
        lastName: "Jovanovic",
        email: "jovana@example.com",
        message: "Zdravo, zanima me vise o vasim uslugama masaze.",
      });

      assert.equal(res.status, 400);
      const result = await contactRepo.findContacts({});
      assert.equal(result.data.length, 0);
    });

    it("silently drops a submission where the honeypot field was filled in", async () => {
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/kontakt");

      const res = await agent.post("/kontakt").type("form").send({
        CSRFToken: token,
        nickname: "im-a-bot",
        firstName: "Bot",
        lastName: "Botovic",
        email: "bot@example.com",
        message: "Ovo je spam poruka koja bi trebalo da bude odbijena.",
        consent: "true",
      });

      assert.equal(res.status, 400);
      const result = await contactRepo.findContacts({});
      assert.equal(result.data.length, 0);
    });

    it("rejects a request without a valid CSRF token", async () => {
      const agent = request.agent(app);
      await agent.get("/kontakt"); 

      const res = await agent.post("/kontakt").type("form").send({
        firstName: "Jovana",
        lastName: "Jovanovic",
        email: "jovana@example.com",
        message: "Poruka bez CSRF tokena.",
        consent: "true",
      });

      assert.equal(res.status, 403);
    });
  });
});