import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateManualOrderCreate } from "../../../src/middlewares/validators/order.validator.js";

function validItem(overrides = {}) {
  return { productId: new Types.ObjectId().toString(), variantId: new Types.ObjectId().toString(), quantity: "2", ...overrides };
}

function validPayload(overrides = {}) {
  return {
    items: [validItem()],
    firstName: "Marko",
    email: "marko@example.com",
    phone: "0601234567",
    address: { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "5" },
    ...overrides,
  };
}

describe("validateManualOrderCreate", () => {
  it("accepts a complete, valid payload", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload());
    assert.equal(res.status, 200);
  });

  it("rejects an item without a productId and reports it against that row", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: [validItem({ productId: "" })] }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors["items[0].productId"]);
  });

  it("rejects a non-ObjectId productId", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: [validItem({ productId: "not-an-id" })] }));
    assert.equal(res.status, 400);
  });

  it("rejects a quantity of zero", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: [validItem({ quantity: "0" })] }));
    assert.equal(res.status, 400);
  });

  it("accepts several products in one order", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: [validItem(), validItem({ price: "1500" }), validItem({ quantity: "1" })] }));
    assert.equal(res.status, 200);
  });

  it("accepts the rows as an object keyed by index too (what qs produces for a sparse form)", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: { 0: validItem(), 3: validItem() } }));
    assert.equal(res.status, 200);
  });

  it("rejects an order with no products at all", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const none = await agent.post("/test").send(validPayload({ items: [] }));
    assert.equal(none.status, 400);
    const missing = validPayload();
    delete missing.items;
    assert.equal((await agent.post("/test").send(missing)).status, 400);
  });

  it("rejects more than 20 products", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ items: Array.from({ length: 21 }, () => validItem()) }));
    assert.equal(res.status, 400);
  });

  it("accepts an empty per-product price (= catalog price) and rejects a negative one", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    assert.equal((await agent.post("/test").send(validPayload({ items: [validItem({ price: "" })] }))).status, 200);
    assert.equal((await agent.post("/test").send(validPayload({ items: [validItem({ price: "-5" })] }))).status, 400);
  });

  it("rejects a missing phone", async () => {
    const payload = validPayload();
    delete payload.phone;
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(payload);
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.phone);
  });

  it("rejects when the address is incomplete", async () => {
    const payload = validPayload();
    delete payload.address.postalCode;
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(payload);
    assert.equal(res.status, 400);
  });

  it("accepts a final total, including 0 (a gift), and treats an empty one as 'automatic'", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    assert.equal((await agent.post("/test").send(validPayload({ finalTotal: "8500" }))).status, 200);
    assert.equal((await agent.post("/test").send(validPayload({ finalTotal: "0" }))).status, 200);
    assert.equal((await agent.post("/test").send(validPayload({ finalTotal: "" }))).status, 200);
  });

  it("rejects a negative or non-numeric final total", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    assert.equal((await agent.post("/test").send(validPayload({ finalTotal: "-100" }))).status, 400);
    assert.equal((await agent.post("/test").send(validPayload({ finalTotal: "abc" }))).status, 400);
  });

  it("accepts an optional existingUserId as a valid ObjectId", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ existingUserId: new Types.ObjectId().toString() }));
    assert.equal(res.status, 200);
  });

  it("rejects an existingUserId that isn't a valid ObjectId", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ existingUserId: "not-an-id" }));
    assert.equal(res.status, 400);
  });
});
