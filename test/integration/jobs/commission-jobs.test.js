import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import Order from "../../../src/models/order.model.js";
import CommissionEntry from "../../../src/models/commission-entry.model.js";
import { runCommissionGracePeriodSweep } from "../../../src/jobs/commission-jobs.js";
import "../../../src/models/user.model.js";
import "../../../src/models/coupon.model.js";
import "../../../src/models/partner.model.js";

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function validOrder(overrides = {}) {
  return {
    user: new mongoose.Types.ObjectId(),
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: { hash: "hash123", encrypted: "encrypted123" },
    address: { city: "Novi Sad", postalCode: "21000", street: "encryptedstreet", number: "encryptednum" },
    items: [{ product: new mongoose.Types.ObjectId(), variant: new mongoose.Types.ObjectId(), title: "Proizvod", variantLabel: "x", price: 2000, quantity: 1 }],
    subtotal: 2000,
    totalPrice: 2000,
    // "pending" - not "confirmed", which was never a real Order status (see
    // order-status-transitions.js's ORDER_STATUSES: pending/processing/shipped/
    // delivered/completed/cancelled/returned/refunded - "confirmed" only exists
    // on the Appointment model, a genuinely different status set)
    status: "pending",
    ...overrides,
  };
}

function pendingEntry(orderId, overrides = {}) {
  return {
    earnerType: "partner",
    partner: new mongoose.Types.ObjectId(),
    sourceType: "order",
    order: orderId,
    baseValue: 2000,
    rate: 10,
    amount: 200,
    status: "pending",
    ...overrides,
  };
}

/**
 * Integration coverage for src/jobs/commission-jobs.js - previously the job
 * wrapper itself (as opposed to the underlying service function it calls) had
 * zero test coverage. Real Order + CommissionEntry documents, real reads/writes.
 */
describe("commission-jobs", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  it("promotes a pending commission to earned once its order is past the grace period and still valid", async () => {
    const order = await Order.create(validOrder({ createdAt: daysAgo(30) }));
    const entry = await CommissionEntry.create(pendingEntry(order._id));

    await runCommissionGracePeriodSweep();

    const updated = await CommissionEntry.findById(entry._id);
    assert.equal(updated.status, "earned");
    assert.ok(updated.earnedAt instanceof Date);
  });

  it("leaves a recent order's commission pending - still inside the grace period", async () => {
    const order = await Order.create(validOrder({ createdAt: daysAgo(1) }));
    const entry = await CommissionEntry.create(pendingEntry(order._id));

    await runCommissionGracePeriodSweep();

    const unchanged = await CommissionEntry.findById(entry._id);
    assert.equal(unchanged.status, "pending");
  });

  it("reverses a commission whose order was cancelled during the grace period", async () => {
    const order = await Order.create(validOrder({ createdAt: daysAgo(30), status: "cancelled" }));
    const entry = await CommissionEntry.create(pendingEntry(order._id));

    await runCommissionGracePeriodSweep();

    const updated = await CommissionEntry.findById(entry._id);
    assert.equal(updated.status, "reversed");
    assert.ok(updated.reversalReason.includes("cancelled"));
  });

  it("REGRESSION: one entry throwing during resolution doesn't block the rest of the sweep", async () => {
    // an entry whose order was deleted entirely (not just cancelled) - the
    // populate comes back null, exercising the "order no longer exists" branch
    const orphanEntry = await CommissionEntry.create(pendingEntry(new mongoose.Types.ObjectId()));
    const goodOrder = await Order.create(validOrder({ createdAt: daysAgo(30) }));
    const goodEntry = await CommissionEntry.create(pendingEntry(goodOrder._id));

    await assert.doesNotReject(() => runCommissionGracePeriodSweep());

    const updatedOrphan = await CommissionEntry.findById(orphanEntry._id);
    const updatedGood = await CommissionEntry.findById(goodEntry._id);
    assert.equal(updatedOrphan.status, "reversed"); // missing order - reversed, not a crash
    assert.equal(updatedGood.status, "earned"); // unaffected
  });

  it("does nothing (and doesn't throw) when there are no pending order commissions", async () => {
    await assert.doesNotReject(() => runCommissionGracePeriodSweep());
  });
});
