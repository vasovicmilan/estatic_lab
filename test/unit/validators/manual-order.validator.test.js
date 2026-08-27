import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateManualOrderCreate } from "../../../src/middlewares/validators/order.validator.js";

function validPayload(overrides = {}) {
  return {
    productId: new Types.ObjectId().toString(),
    variantId: new Types.ObjectId().toString(),
    quantity: "2",
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

  it("rejects a missing productId", async () => {
    const payload = validPayload();
    delete payload.productId;
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(payload);
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.productId);
  });

  it("rejects a non-ObjectId productId", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ productId: "not-an-id" }));
    assert.equal(res.status, 400);
  });

  it("rejects a quantity of zero", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ quantity: "0" }));
    assert.equal(res.status, 400);
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

  it("accepts a valid priceOverride", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ priceOverride: "8500" }));
    assert.equal(res.status, 200);
  });

  it("rejects a negative priceOverride", async () => {
    const agent = buildValidatorHarness(validateManualOrderCreate);
    const res = await agent.post("/test").send(validPayload({ priceOverride: "-100" }));
    assert.equal(res.status, 400);
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
