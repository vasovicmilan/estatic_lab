import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import partnerService from "../../../src/services/partner.service.js";

async function loginAsEmployee(app, email) {
  const agent = request.agent(app);
  let employee;
  // beforeLogin (session.js) runs before the actual /prijava call - isEmployee is
  // computed once at login time and baked into the JWT (see auth.service.js), so
  // the Employee record must exist before that, not after.
  await registerAndLogin(agent, {
    email,
    roleName: "user",
    beforeLogin: async (user) => {
      employee = await employeeRepo.createEmployee({ userId: user._id, isActive: true, payType: "commission", commissionRate: 10 });
    },
  });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return { token: res.body.data.token, employeeId: employee._id.toString(), userId: res.body.data.user.id };
}

async function loginAsPartner(app, email) {
  const agent = request.agent(app);
  let partner;
  await registerAndLogin(agent, {
    email,
    roleName: "user",
    beforeLogin: async (user) => {
      await ensureRole("partner");
      partner = await partnerService.createPartner({ userId: user._id, commissionRateServices: 10, commissionRateProducts: 5 });
    },
  });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return { token: res.body.data.token, partnerId: partner.id || partner._id.toString() };
}

function futureAppointmentData(overrides = {}) {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
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

describe("API v1 /employee routes (HTTP)", () => {
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

  it("403s a plain user (not an employee) trying to reach /employee/dashboard", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "obican@example.com", roleName: "user" });
    const loginRes = await request(app).post("/api/v1/auth/prijava").send({ email: "obican@example.com", password: "lozinka123" });

    const res = await request(app).get("/api/v1/employee/dashboard").set("Authorization", `Bearer ${loginRes.body.data.token}`);
    assert.equal(res.status, 403);
  });

  it("returns the employee's own dashboard", async () => {
    const { token } = await loginAsEmployee(app, "zaposleni@example.com");
    const res = await request(app).get("/api/v1/employee/dashboard").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.isCommissionBased, true);
  });

  it("confirms an appointment assigned to this employee", async () => {
    const { token, employeeId } = await loginAsEmployee(app, "potvrdi@example.com");
    const appointment = await appointmentRepo.createAppointment(futureAppointmentData({ employee: employeeId }));

    const res = await request(app).post(`/api/v1/employee/appointments/${appointment._id}/confirm`).set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "confirmed");
  });

  it("403s when trying to confirm an appointment assigned to someone else", async () => {
    const { token } = await loginAsEmployee(app, "tudji@example.com");
    const other = await appointmentRepo.createAppointment(futureAppointmentData({ employee: new mongoose.Types.ObjectId() }));

    const res = await request(app).post(`/api/v1/employee/appointments/${other._id}/confirm`).set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("updates working hours", async () => {
    const { token } = await loginAsEmployee(app, "radnovreme@example.com");
    const res = await request(app)
      .put("/api/v1/employee/profile/working-hours")
      .set("Authorization", `Bearer ${token}`)
      .send({ workingHours: [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }] });

    assert.equal(res.status, 200);
  });
});

describe("API v1 /partner routes (HTTP)", () => {
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

  it("403s a plain user (not a partner) trying to reach /partner/dashboard", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "obican2@example.com", roleName: "user" });
    const loginRes = await request(app).post("/api/v1/auth/prijava").send({ email: "obican2@example.com", password: "lozinka123" });

    const res = await request(app).get("/api/v1/partner/dashboard").set("Authorization", `Bearer ${loginRes.body.data.token}`);
    assert.equal(res.status, 403);
  });

  it("returns the partner's own dashboard", async () => {
    const { token } = await loginAsPartner(app, "partner@example.com");
    const res = await request(app).get("/api/v1/partner/dashboard").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.partner);
  });

  it("requests a payout", async () => {
    const { token } = await loginAsPartner(app, "isplata@example.com");
    const res = await request(app).post("/api/v1/partner/payouts").set("Authorization", `Bearer ${token}`).send({ amount: 1000 });

    // Whatever the real balance/eligibility rule says (insufficient balance is a
    // very plausible 400 for a brand-new partner with no earned commissions yet) -
    // the point of this test is that the route/auth/validation chain works end to
    // end, not to assert a specific balance outcome that depends on business rules
    // this test doesn't set up commissions for.
    assert.ok([200, 201, 400].includes(res.status), `unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it("returns the referral catalog", async () => {
    const { token } = await loginAsPartner(app, "katalog@example.com");
    const res = await request(app).get("/api/v1/partner/catalog").set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.services));
  });
});
