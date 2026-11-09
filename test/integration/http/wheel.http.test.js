import { describe, it, before, after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";
import wheelPrizeRepo from "../../../src/repositories/wheel-prize.repository.js";
import leadRepo from "../../../src/repositories/lead.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";

const metaToken = (html) => (html.match(/<meta name="csrf-token" content="([^"]*)"/) || [])[1] || "";

const body = (o = {}) => ({
  firstName: "Ana",
  lastName: "Anić",
  email: "ana@example.com",
  phone: "064 123 4567",
  segment: "usluge",
  consentContact: true,
  ...o,
});

describe("prize wheel (HTTP)", () => {
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
  // one unlimited 10% prize only, so the draw is deterministic and needs no services in the test DB
  beforeEach(async () => {
    await wheelPrizeRepo.createPrizes([
      { key: "popust-10", label: "10% popusta", shortLabel: "10% popust", weight: 1, isFallback: true, discountType: "percentage", discountValue: 10, validDays: 30, order: 1 },
    ]);
  });

  async function pageAndToken(agent) {
    const res = await agent.get("/tocak?src=sajam-test");
    return { res, token: metaToken(res.text) };
  }

  it("renders the page as noindex, with the wheel data embedded", async () => {
    const { res } = await pageAndToken(request.agent(app));
    assert.equal(res.status, 200);
    assert.match(res.text, /noindex/);
    assert.match(res.text, /id="wheelData"/);
    assert.match(res.text, /10% popust/);
  });

  it("spins: saves the lead, mints a single-use coupon and returns the code with the animation plan", async () => {
    const agent = request.agent(app);
    const { token } = await pageAndToken(agent);

    const res = await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body({ source: "sajam-test" }));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.couponCode, /^TOCAK-/);
    assert.ok(res.body.turns >= 3 && res.body.turns <= 9);

    const coupon = await couponRepo.findCouponByCode(res.body.couponCode);
    assert.equal(coupon.maxUses, 1);
    assert.equal(coupon.discountValue, 10);

    const lead = await leadRepo.findLeadByEmailOrPhoneHash("ana@example.com", "x");
    assert.equal(lead.source, "sajam-test");
    assert.equal(lead.couponCode, res.body.couponCode);
  });

  it("refuses a second spin with the same email, and with the same phone under another email", async () => {
    const agent = request.agent(app);
    const { token } = await pageAndToken(agent);
    assert.equal((await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body())).status, 200);

    const sameEmail = await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body({ phone: "065 999 8888" }));
    assert.equal(sameEmail.status, 409);

    const samePhone = await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body({ email: "druga@example.com" }));
    assert.equal(samePhone.status, 409);

    const awarded = (await wheelPrizeRepo.findAllPrizes())[0].awardedCount;
    assert.equal(awarded, 1, "refused spins must not take anything from the stock");
  });

  it("rejects a submission without the contact consent (400) and without a CSRF token (403)", async () => {
    const agent = request.agent(app);
    const { token } = await pageAndToken(agent);
    const noConsent = await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body({ consentContact: false }));
    assert.equal(noConsent.status, 400);
    assert.ok(noConsent.body.errors.consentContact);

    const noToken = await agent.post("/tocak/vrti").send(body({ email: "x@example.com" }));
    assert.equal(noToken.status, 403);
  });

  it("silently refuses a bot that fills the hidden honeypot field", async () => {
    const agent = request.agent(app);
    const { token } = await pageAndToken(agent);
    const res = await agent.post("/tocak/vrti").set("X-CSRF-Token", token).send(body({ nickname: "bot" }));
    assert.equal(res.status, 400);
    assert.equal((await leadRepo.findLeads({})).data.length, 0);
  });

  it("keeps the admin lead list, prize page and CSV export away from anonymous visitors", async () => {
    for (const path of ["/admin/tocak", "/admin/tocak/nagrade", "/admin/tocak/izvoz.csv", "/admin/tocak/qr.png"]) {
      const res = await request(app).get(path);
      assert.ok([302, 401, 403].includes(res.status), `${path} -> ${res.status}`);
    }
  });

  it("lets an admin open the lead list, the prize page, the QR download and the CSV export", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    assert.equal((await agent.get("/admin/tocak")).status, 200);
    const prizes = await agent.get("/admin/tocak/nagrade?src=sajam-ns-2026");
    assert.equal(prizes.status, 200);
    assert.match(prizes.text, /tocak\?src=sajam-ns-2026/);
    assert.match(prizes.text, /<svg/);

    const png = await agent.get("/admin/tocak/qr.png?src=sajam-ns-2026");
    assert.equal(png.status, 200);
    assert.equal(png.headers["content-type"], "image/png");

    const csv = await agent.get("/admin/tocak/izvoz.csv");
    assert.equal(csv.status, 200);
    assert.match(csv.headers["content-type"], /text\/csv/);
  });
});
