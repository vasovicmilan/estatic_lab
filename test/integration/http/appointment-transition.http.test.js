import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import Appointment from "../../../src/models/appointment.model.js";
import PackagePurchase from "../../../src/models/package-purchase.model.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import * as appointmentService from "../../../src/services/appointment.service.js";
import { buildAppointment, buildPackagePurchase, id } from "../../helpers/factories.js";

// Prava transakcija nad pravom bazom (replica set): status termina i seansa paketa se
// menjaju zajedno ili nikako.
describe("appointment status + package session - real transaction", () => {
  before(async () => { await createTestApp(); });
  after(async () => { await closeTestApp(); });
  afterEach(async () => { await clearTestDatabase(); });

  async function seed({ status = "confirmed", used = 0, reserved = 1, total = 5 } = {}) {
    const variantId = id();
    const purchaseId = id();
    const purchase = buildPackagePurchase();
    await PackagePurchase.collection.insertOne({
      ...purchase,
      _id: purchaseId,
      status: "active",
      items: [{ ...purchase.items[0], servicePackageId: variantId, sessionsTotal: total, sessionsUsed: used, sessionsReserved: reserved }],
    });
    const appointment = buildAppointment({
      status,
      packagePurchase: purchaseId,
      coupon: null,
      variant: { servicePackageId: variantId, name: "60 min", duration: 60, price: 3000 },
    });
    await Appointment.collection.insertOne({
      ...appointment,
      user: appointment.user?._id ?? appointment.user,
      service: appointment.service?._id ?? appointment.service,
      employee: null,
      assignedTo: null,
      resources: [],
    });
    return { appointmentId: appointment._id.toString(), purchaseId };
  }

  const counters = async (purchaseId) => {
    const p = await PackagePurchase.findById(purchaseId).lean();
    return [p.items[0].sessionsReserved, p.items[0].sessionsUsed];
  };
  const statusOf = async (appointmentId) => (await Appointment.findById(appointmentId).lean()).status;

  it("completes an appointment and consumes exactly one session", async () => {
    const { appointmentId, purchaseId } = await seed({ reserved: 2 });
    await appointmentService.completeAppointment(appointmentId, id().toString(), "admin");
    assert.equal(await statusOf(appointmentId), "completed");
    assert.deepEqual(await counters(purchaseId), [1, 1]);
  });

  it("two simultaneous completions consume ONE session, not two", async () => {
    const { appointmentId, purchaseId } = await seed({ reserved: 2 }); // druga rezervacija pripada drugom terminu
    // oba zahteva pročitaju "confirmed" pre nego što ijedan upiše
    const realFind = appointmentRepo.findAppointmentById;
    let waiting = [];
    let reads = 0;
    appointmentRepo.findAppointmentById = async (...args) => {
      const doc = await realFind(...args);
      reads += 1;
      if (reads <= 2) {
        await new Promise((resolve) => { waiting.push(resolve); if (waiting.length === 2) waiting.forEach((r) => r()); });
      }
      return doc;
    };
    let results;
    try {
      results = await Promise.allSettled([
        appointmentService.completeAppointment(appointmentId, id().toString(), "admin"),
        appointmentService.completeAppointment(appointmentId, id().toString(), "admin"),
      ]);
    } finally {
      appointmentRepo.findAppointmentById = realFind;
    }
    assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(results.find((r) => r.status === "rejected").reason.statusCode, 409);
    assert.deepEqual(await counters(purchaseId), [1, 1]);
  });

  it("rolls the status back when the package step fails", async () => {
    const { appointmentId, purchaseId } = await seed({ reserved: 0 }); // nema šta da se potroši
    await assert.rejects(() => appointmentService.completeAppointment(appointmentId, id().toString(), "admin"), (e) => e.statusCode === 400);
    assert.equal(await statusOf(appointmentId), "confirmed");
    assert.deepEqual(await counters(purchaseId), [0, 0]);
  });

  it("keeps status and package unchanged when the transaction fails after the status write", async () => {
    const { appointmentId, purchaseId } = await seed();
    // upis statusa prođe uslovno, a zatim transakcija pada pre potvrde
    const realUpdate = appointmentRepo.updateAppointmentById;
    appointmentRepo.updateAppointmentById = async (...args) => { await realUpdate(...args); throw new Error("pad posle upisa statusa"); };
    try {
      await assert.rejects(() => appointmentService.cancelAppointment(appointmentId, "x", id().toString(), "admin"), /pad posle upisa/);
    } finally {
      appointmentRepo.updateAppointmentById = realUpdate;
    }
    assert.equal(await statusOf(appointmentId), "confirmed");
    assert.deepEqual(await counters(purchaseId), [1, 0]);
  });

  it("deleting an active appointment gives its reserved session back exactly once", async () => {
    const { appointmentId, purchaseId } = await seed({ reserved: 2 });
    const results = await Promise.allSettled([
      appointmentService.deleteAppointmentById(appointmentId, id().toString()),
      appointmentService.deleteAppointmentById(appointmentId, id().toString()),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.deepEqual(await counters(purchaseId), [1, 0]);
    assert.equal(await Appointment.findById(appointmentId), null);
  });
});
