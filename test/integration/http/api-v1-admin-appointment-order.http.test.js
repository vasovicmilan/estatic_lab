import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import orderRepo from "../../../src/repositories/order.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import productRepo from "../../../src/repositories/product.repository.js";
import tempOrderRepo from "../../../src/repositories/temporary-order.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import { buildProduct } from "../../helpers/factories.js";

const ALL_WEEK_WORKING_HOURS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => ({
  day,
  slots: [{ from: "00:00", to: "23:59" }],
}));

// Same reasoning as booking.http.test.js/api-v1-booking.http.test.js's own
// createBookableService - resolveEmployeeAssignment (appointment.service.js)
// throws "Nijedan terapeut nije dostupan" when no employee is free for the
// service, so manual creation needs one too, not just the service itself.
async function createEmployeeForService(serviceId) {
  const role = await ensureRole("employee");
  const employeeUser = await userRepo.createUser({ email: `terapeut-${Date.now()}@example.com`, password: "lozinka123", firstName: "Ana", lastName: "Anic", role: role._id });
  return employeeRepo.createEmployee({ userId: employeeUser._id, services: [serviceId], isActive: true, workingHours: ALL_WEEK_WORKING_HOURS });
}

async function loginAsAdmin(app, email) {
  const agent = request.agent(app);
  await registerAndLogin(agent, { email, roleName: "admin" });
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: "lozinka123" });
  if (!res.body?.data?.token) {
    throw new Error(`loginAsAdmin(${email}) did not get a token - status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  return res.body.data.token;
}

function futureAppointmentData(overrides = {}) {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000); // clear of userCancellationCutoffHours (24h default)
  start.setHours(10, 0, 0, 0);
  return {
    user: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: { hash: "h", encrypted: "e" } },
    ...overrides,
  };
}

function validOrderData(overrides = {}) {
  return {
    user: new mongoose.Types.ObjectId(),
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: { hash: "h", encrypted: "e" },
    address: { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" },
    items: [{ product: new mongoose.Types.ObjectId(), variant: new mongoose.Types.ObjectId(), title: "Test Proizvod", variantLabel: "50ml", price: 2000, quantity: 1 }],
    subtotal: 2000,
    status: "pending",
    ...overrides,
  };
}

describe("API v1 admin appointment routes (HTTP)", () => {
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

  it("lists, confirms, and reschedules an appointment", async () => {
    const token = await loginAsAdmin(app, "admin1@example.com");
    const appointment = await appointmentRepo.createAppointment(futureAppointmentData());

    const listRes = await request(app).get("/api/v1/admin/appointments").set("Authorization", `Bearer ${token}`);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.data.some((a) => a.id === appointment._id.toString()));

    const confirmRes = await request(app).put(`/api/v1/admin/appointments/${appointment._id}/confirm`).set("Authorization", `Bearer ${token}`);
    assert.equal(confirmRes.status, 200);
    const afterConfirm = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(afterConfirm.status, "confirmed");

    const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const rescheduleRes = await request(app).put(`/api/v1/admin/appointments/${appointment._id}/reschedule`).set("Authorization", `Bearer ${token}`).send({ newStartTime: newStart });
    assert.equal(rescheduleRes.status, 200);
  });

  it("creates a manual appointment for a guest", async () => {
    const token = await loginAsAdmin(app, "admin2@example.com");
    const service = await serviceRepo.createService({
      name: "Sportska Masaza",
      slug: "sportska-masaza",
      image: { img: "/images/services/x.webp", imgDesc: "x" },
      packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
      isActive: true,
    });
    await createEmployeeForService(service._id);
    // bookAppointment (via createManualAppointment) creates a new guest User for
    // an unrecognized email - that needs the default "user" role to exist first,
    // same reasoning already fixed once for api-v1-booking.http.test.js's guest
    // booking test.
    await ensureRole("user");
    // Explicit mid-day time, not "now + 24h" - the employee works 00:00-23:59,
    // but a 60-minute appointment starting late enough at night would spill
    // past 23:59 into the next calendar day, which working-hours validation
    // correctly rejects (working hours are per-day, they don't span midnight).
    // Run this suite late in the evening and "+24h" can land right on that
    // edge - not a bug, just this test being time-of-day dependent for no
    // reason. Tomorrow at a safely mid-day hour has no such edge regardless
    // of when the suite runs.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const startTime = tomorrow.toISOString();

    const res = await request(app)
      .post("/api/v1/admin/appointments/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        servicePackageId: service.packages[0]._id.toString(),
        startTime,
        firstName: "Marko",
        lastName: "Markovic",
        email: "gost@example.com",
        phone: "0601234567",
        priceOverride: 0, // walk-in gift, matches manual-appointment.controller.js's own giveaway example
      });

    assert.equal(res.status, 201);
  });

  it("deletes an appointment", async () => {
    const token = await loginAsAdmin(app, "admin3@example.com");
    const appointment = await appointmentRepo.createAppointment(futureAppointmentData());

    const res = await request(app).delete(`/api/v1/admin/appointments/${appointment._id}`).set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
  });
});

describe("API v1 admin order routes (HTTP)", () => {
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

  it("lists orders and transitions pending -> processing -> shipped", async () => {
    const token = await loginAsAdmin(app, "admin4@example.com");
    const order = await orderRepo.createOrder(validOrderData());

    const listRes = await request(app).get("/api/v1/admin/orders").set("Authorization", `Bearer ${token}`);
    assert.equal(listRes.status, 200);

    const processRes = await request(app).put(`/api/v1/admin/orders/${order._id}/process`).set("Authorization", `Bearer ${token}`);
    assert.equal(processRes.status, 200);

    const shipRes = await request(app).put(`/api/v1/admin/orders/${order._id}/ship`).set("Authorization", `Bearer ${token}`);
    assert.equal(shipRes.status, 200);

    const final = await orderRepo.findOrderById(order._id);
    assert.equal(final.status, "shipped");
  });

  it("updates order contact info", async () => {
    const token = await loginAsAdmin(app, "admin5@example.com");
    const order = await orderRepo.createOrder(validOrderData());

    const res = await request(app)
      .put(`/api/v1/admin/orders/${order._id}/contact`)
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "0659998877", address: { city: "Beograd", postalCode: "11000", street: "Druga Ulica", number: "5" } });

    assert.equal(res.status, 200);
  });

  it("creates a manual order for a guest", async () => {
    const token = await loginAsAdmin(app, "admin6@example.com");
    const product = await productRepo.createProduct(buildProduct({ name: "Test Proizvod", slug: "test-proizvod" }));
    // Same "needs the default user role for a new guest account" reasoning as the
    // manual appointment test above.
    await ensureRole("user");

    const res = await request(app)
      .post("/api/v1/admin/orders/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId: product._id.toString(),
        variantId: product.variations[0]._id.toString(),
        quantity: 1,
        firstName: "Marko",
        lastName: "Markovic",
        email: "gost@example.com",
        phone: "0601234567",
        address: { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" },
      });

    assert.equal(res.status, 201);
  });

  it("lists and confirms a temporary order", async () => {
    const token = await loginAsAdmin(app, "admin7@example.com");
    const tempOrder = await tempOrderRepo.createTemporaryOrder({
      user: new mongoose.Types.ObjectId(),
      contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "gost2@example.com" },
      phone: { hash: "h", encrypted: "e" },
      address: { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" },
      items: [{ product: new mongoose.Types.ObjectId(), variant: new mongoose.Types.ObjectId(), title: "Test Proizvod", variantLabel: "50ml", price: 2000, quantity: 1 }],
      subtotal: 2000,
      shipping: 300,
      verificationToken: "test-token",
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
    });

    const listRes = await request(app).get("/api/v1/admin/temporary-orders").set("Authorization", `Bearer ${token}`);
    assert.equal(listRes.status, 200);

    const confirmRes = await request(app).put(`/api/v1/admin/temporary-orders/${tempOrder._id}/confirm`).set("Authorization", `Bearer ${token}`);
    assert.equal(confirmRes.status, 200);
  });
});
