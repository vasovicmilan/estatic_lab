import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";
import productRepo from "../../../src/repositories/product.repository.js";
import { buildProduct } from "../../helpers/factories.js";

async function loginAndGetToken(app, email) {
  const agent = request.agent(app);
  await registerAndLogin(agent, { email, roleName: "user" });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return res.body.data.token;
}

describe("API v1 cart/checkout routes (HTTP)", () => {
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

  it("requires authentication - no token gets a 401, not a guest cart", async () => {
    // Deliberate API v1 scope decision (see cart.controller.js) - unlike the web
    // cart, there's no session-based guest cart here.
    const res = await request(app).get("/api/v1/cart");
    assert.equal(res.status, 401);
  });

  it("adds an item, then reflects it in GET /cart", async () => {
    const product = await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));
    const token = await loginAndGetToken(app, "kupac@example.com");

    const addRes = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: product.variations[0]._id.toString(), quantity: 2 });

    assert.equal(addRes.status, 201);
    assert.equal(addRes.body.success, true);
    assert.equal(addRes.body.data.stavke.length, 1);
    assert.equal(addRes.body.data.stavke[0].kolicina, 2);

    const getRes = await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${token}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.stavke.length, 1);
  });

  it("updates an item's quantity via cartItemId", async () => {
    const product = await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));
    const token = await loginAndGetToken(app, "kupac2@example.com");

    await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: product.variations[0]._id.toString(), quantity: 1 });

    const cart = await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${token}`);
    const cartItemId = cart.body.data.stavke[0].id;

    const res = await request(app).put("/api/v1/cart/items").set("Authorization", `Bearer ${token}`).send({ cartItemId, quantity: 5 });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stavke[0].kolicina, 5);
  });

  it("removes an item via cartItemId", async () => {
    const product = await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));
    const token = await loginAndGetToken(app, "kupac3@example.com");

    await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: product.variations[0]._id.toString(), quantity: 1 });

    const cart = await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${token}`);
    const cartItemId = cart.body.data.stavke[0].id;

    const res = await request(app).delete("/api/v1/cart/items").set("Authorization", `Bearer ${token}`).send({ cartItemId });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stavke.length, 0);
  });

  it("checkout creates a pending order and clears the cart, refusing an empty cart", async () => {
    const product = await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));
    const token = await loginAndGetToken(app, "kupac4@example.com");

    const emptyCheckout = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Marko", lastName: "Markovic", email: "kupac4@example.com", phone: "0601234567", city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" });
    assert.equal(emptyCheckout.status, 400, "an empty cart must refuse checkout");

    await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product._id.toString(), variantId: product.variations[0]._id.toString(), quantity: 1 });

    // lastName is required here even though validateCheckout treats it as optional -
    // TemporaryOrder's contactSnapshot.lastName is `required: true` in the model
    // (see temporary-order.model.js) with no default, so an omitted lastName throws
    // a raw Mongoose ValidationError (500) rather than a clean 400. A real web
    // customer never hits this because the HTML form marks the field required at the
    // UI level, independent of the backend validator - but the validator/model
    // mismatch itself is still there and worth deciding on (relax the model to
    // optional, or make validateCheckout actually require it) - not changed here,
    // this test just supplies it like a real customer would.
    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Marko", lastName: "Markovic", email: "kupac4@example.com", phone: "0601234567", city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.orderId);

    const cartAfter = await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${token}`);
    assert.equal(cartAfter.body.data.stavke.length, 0, "cart should be cleared once its contents are earmarked in the pending order");
  });
});
