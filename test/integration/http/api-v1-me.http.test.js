import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import orderRepo from "../../../src/repositories/order.repository.js";

async function loginAndGetToken(app, email) {
  const agent = request.agent(app);
  await registerAndLogin(agent, { email, roleName: "user" });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return { token: res.body.data.token, userId: res.body.data.user.id };
}

function futureAppointmentData(userId, overrides = {}) {
  // 48h out, not 24h - userCancellationCutoffHours defaults to exactly 24 (see
  // runtime-settings.cache.js), so "now + 24h, hour pinned to 10:00" can land on
  // either side of that cutoff depending on what time of day the suite happens to
  // run - the same class of boundary flake already fixed once for the "danas"
  // presenter test. 48h clears it regardless of current time of day.
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  return {
    user: userId,
    service: new mongoose.Types.ObjectId(),
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: { hash: "h", encrypted: "e" } },
    ...overrides,
  };
}

function validOrderData(userId, overrides = {}) {
  return {
    user: userId,
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: { hash: "h", encrypted: "e" },
    address: { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" },
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: new mongoose.Types.ObjectId(),
        title: "Test Proizvod",
        variantLabel: "50ml",
        price: 2000,
        quantity: 1,
      },
    ],
    subtotal: 2000,
    status: "pending",
    ...overrides,
  };
}

describe("API v1 /me routes (HTTP)", () => {
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

  it("requires authentication for every /me route", async () => {
    const res = await request(app).get("/api/v1/me");
    assert.equal(res.status, 401);
  });

  describe("profile", () => {
    it("returns the caller's own profile", async () => {
      const { token } = await loginAndGetToken(app, "profil@example.com");
      const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.email, "profil@example.com");
    });

    it("updates firstName/lastName", async () => {
      const { token } = await loginAndGetToken(app, "izmena@example.com");
      const res = await request(app).put("/api/v1/me").set("Authorization", `Bearer ${token}`).send({ firstName: "Izmenjeno", lastName: "Prezime" });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.firstName, "Izmenjeno");
    });

    it("changes the password, and the old password no longer works", async () => {
      const { token } = await loginAndGetToken(app, "lozinka@example.com");
      const res = await request(app)
        .put("/api/v1/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "lozinka123", newPassword: "novalozinka456", confirmPassword: "novalozinka456" });

      assert.equal(res.status, 200);

      const oldLogin = await request(app).post("/api/v1/auth/prijava").send({ email: "lozinka@example.com", password: "lozinka123" });
      assert.equal(oldLogin.status, 401);

      const newLogin = await request(app).post("/api/v1/auth/prijava").send({ email: "lozinka@example.com", password: "novalozinka456" });
      assert.equal(newLogin.status, 200);
    });
  });

  describe("appointments", () => {
    it("lists only the caller's own appointments", async () => {
      const { token, userId } = await loginAndGetToken(app, "termini@example.com");
      await appointmentRepo.createAppointment(futureAppointmentData(userId));
      await appointmentRepo.createAppointment(futureAppointmentData(new mongoose.Types.ObjectId())); // someone else's

      const res = await request(app).get("/api/v1/me/appointments").set("Authorization", `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    it("403s when trying to view someone else's appointment", async () => {
      const { token } = await loginAndGetToken(app, "tudji@example.com");
      const other = await appointmentRepo.createAppointment(futureAppointmentData(new mongoose.Types.ObjectId()));

      const res = await request(app).get(`/api/v1/me/appointments/${other._id}`).set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 403);
    });

    it("cancels the caller's own appointment", async () => {
      const { token, userId } = await loginAndGetToken(app, "otkazi@example.com");
      const appointment = await appointmentRepo.createAppointment(futureAppointmentData(userId));

      const res = await request(app)
        .post(`/api/v1/me/appointments/${appointment._id}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Predomislio sam se" });

      assert.equal(res.status, 200);
      const updated = await appointmentRepo.findAppointmentById(appointment._id);
      assert.equal(updated.status, "cancelled");
    });
  });

  describe("orders", () => {
    it("lists only the caller's own orders", async () => {
      const { token, userId } = await loginAndGetToken(app, "porudzbine@example.com");
      await orderRepo.createOrder(validOrderData(userId));
      await orderRepo.createOrder(validOrderData(new mongoose.Types.ObjectId())); // someone else's

      const res = await request(app).get("/api/v1/me/orders").set("Authorization", `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    it("cancels the caller's own pending order", async () => {
      const { token, userId } = await loginAndGetToken(app, "otkazi-porudzbinu@example.com");
      const order = await orderRepo.createOrder(validOrderData(userId));

      const res = await request(app).post(`/api/v1/me/orders/${order._id}/cancel`).set("Authorization", `Bearer ${token}`).send({});

      assert.equal(res.status, 200);
    });
  });

  describe("addresses", () => {
    it("adds, lists, sets default, and removes an address", async () => {
      const { token } = await loginAndGetToken(app, "adrese@example.com");

      const addRes = await request(app)
        .post("/api/v1/me/addresses")
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "Kuća", city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1" });
      assert.equal(addRes.status, 201);
      assert.equal(addRes.body.data.length, 1);
      const addressId = addRes.body.data[0].id;

      const listRes = await request(app).get("/api/v1/me/addresses").set("Authorization", `Bearer ${token}`);
      assert.equal(listRes.body.data.length, 1);

      const defaultRes = await request(app).put(`/api/v1/me/addresses/${addressId}/default`).set("Authorization", `Bearer ${token}`);
      assert.equal(defaultRes.status, 200);

      const removeRes = await request(app).delete(`/api/v1/me/addresses/${addressId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(removeRes.status, 200);

      const finalList = await request(app).get("/api/v1/me/addresses").set("Authorization", `Bearer ${token}`);
      assert.equal(finalList.body.data.length, 0);
    });
  });
});
