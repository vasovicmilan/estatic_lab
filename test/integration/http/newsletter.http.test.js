import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import newsLetterRepo from "../../../src/repositories/news-letter.repository.js";
import { getCsrfToken } from "../../helpers/csrf.js";

describe("public newsletter flow (HTTP)", () => {
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

    describe("GET /", () => {
        it("renders the homepage with the newsletter subscribe form", async () => {
            const res = await request(app).get("/");
            assert.equal(res.status, 200);
            assert.match(res.text, /newsletter\/prijava/);
        });
    });

    describe("POST /newsletter/prijava", () => {
        it("subscribes a new email and redirects back with a success flash message", async () => {
            const agent = request.agent(app);
            const { token: csrfToken } = await getCsrfToken(agent, "/");

            const res = await agent
                .post("/newsletter/prijava")
                .type("form")
                .send({ email: "novi@example.com", CSRFToken: csrfToken });

            assert.equal(res.status, 302);
            const subscriber = await newsLetterRepo.findSubscriberByEmail("novi@example.com");
            assert.ok(subscriber, "a subscriber document should have been created");
        });

        it("rejects an invalid email and redirects back without creating a subscriber", async () => {
            const agent = request.agent(app);
            const { token: csrfToken } = await getCsrfToken(agent, "/");

            const res = await agent
                .post("/newsletter/prijava")
                .type("form")
                .send({ email: "not-an-email", CSRFToken: csrfToken });

            assert.equal(res.status, 302);
            const subscriber = await newsLetterRepo.findSubscriberByEmail("not-an-email");
            assert.equal(subscriber, null);
        });
    });

    describe("GET /newsletter/odjava/:token", () => {
        it("unsubscribes a valid token and redirects home", async () => {
            const created = await newsLetterRepo.createSubscriber({ email: "odjava@example.com", unsubscribeToken: "real-token" });

            const res = await request(app).get("/newsletter/odjava/real-token");

            assert.equal(res.status, 302);
            assert.equal(res.headers.location, "/");
            const updated = await newsLetterRepo.findSubscriberById(created._id);
            assert.equal(updated.status, "unsubscribed");
        });

        it("redirects home gracefully for an invalid token, without throwing", async () => {
            const res = await request(app).get("/newsletter/odjava/bad-token");
            assert.equal(res.status, 302);
            assert.equal(res.headers.location, "/");
        });
    });
});