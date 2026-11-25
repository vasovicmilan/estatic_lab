import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

describe("anonymous visitors do not create sessions (HTTP)", () => {
  let app;
  const sessionCount = () => mongoose.connection.db.collection("sessions").countDocuments();

  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp();
  });
  afterEach(async () => {
    await clearTestDatabase();
  });

  it("GET / for a browser without cookies writes no session and no cookie", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get("/").set("User-Agent", CHROME);
      assert.equal(res.status, 200);
      assert.equal(res.headers["set-cookie"], undefined);
      assert.match(res.text, /<meta name="csrf-token" content="">/);
    }
    assert.equal(await sessionCount(), 0);
  });

  it("GET /csrf-token creates the session and returns a token that works for a form post", async () => {
    const agent = request.agent(app);
    const res = await agent.get("/csrf-token").set("User-Agent", CHROME);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token.length > 10);
    assert.match(res.headers["cache-control"], /no-store/);
    assert.equal(await sessionCount(), 1);

    const again = await agent.get("/csrf-token").set("User-Agent", CHROME);
    assert.equal(again.body.token, res.body.token);
  });

  it("a public form page still carries the token in the form itself", async () => {
    const agent = request.agent(app);
    const res = await agent.get("/kontakt").set("User-Agent", CHROME);
    assert.equal(res.status, 200);
    assert.match(res.text, /name="CSRFToken" value="[^"]{10,}"/);
  });

  it("a request body over 100 KB on a public route is refused with 413", async () => {
    const res = await request(app).post("/newsletter/prijava").type("form").send({ email: "a@b.rs", filler: "x".repeat(150 * 1024) });
    assert.equal(res.status, 413);
  });
});
