import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";

async function createServiceAndEmployee() {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/x.webp", imgDesc: "x" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
  });

  const employeeRole = await ensureRole("employee");
  const employeeUser = await userRepo.createUser({
    email: `terapeut-${new mongoose.Types.ObjectId()}@example.com`,
    password: "lozinka123",
    firstName: "Ana",
    lastName: "Anic",
    role: employeeRole._id,
  });
  const employee = await employeeRepo.createEmployee({ userId: employeeUser._id, services: [service._id], isActive: true });

  return { service, employee };
}

function validAppointmentData(overrides = {}) {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    user: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: "0601234567" },
    ...overrides,
  };
}

describe("admin appointment actions (HTTP)", () => {
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

  it("confirms a pending appointment", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const appointment = await appointmentRepo.createAppointment(validAppointmentData({ status: "pending" }));

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointment._id}`);
    const res = await agent.put(`/admin/termini/${appointment._id}/potvrdi`).type("form").send({ CSRFToken: token });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "confirmed");
  });

  it("rejects a pending appointment with a reason", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const appointment = await appointmentRepo.createAppointment(validAppointmentData({ status: "pending" }));

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointment._id}`);
    const res = await agent
      .put(`/admin/termini/${appointment._id}/odbij`)
      .type("form")
      .send({ CSRFToken: token, reason: "Nema slobodnog terapeuta" });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "rejected");
    assert.equal(updated.rejectionReason, "Nema slobodnog terapeuta");
    assert.equal(updated.rejectedBy, "admin");
  });

  it("cancels a confirmed appointment, bypassing the 24h rule that applies to plain users", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const soonStart = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes out — would fail the 24h rule for a "user"
    const appointment = await appointmentRepo.createAppointment(
      validAppointmentData({ status: "confirmed", startTime: soonStart, endTime: new Date(soonStart.getTime() + 60 * 60000) })
    );

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointment._id}`);
    const res = await agent
      .put(`/admin/termini/${appointment._id}/otkazi`)
      .type("form")
      .send({ CSRFToken: token, reason: "Administrativno otkazivanje" });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "cancelled");
    assert.equal(updated.cancelledBy, "admin");
  });

  it("completes a confirmed appointment", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const appointment = await appointmentRepo.createAppointment(validAppointmentData({ status: "confirmed" }));

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointment._id}`);
    const res = await agent.put(`/admin/termini/${appointment._id}/zavrsi`).type("form").send({ CSRFToken: token });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "completed");
  });

  it("reassigns an appointment to a free employee", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { employee } = await createServiceAndEmployee();
    const appointment = await appointmentRepo.createAppointment(validAppointmentData({ status: "confirmed" }));

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointment._id}`);
    const res = await agent
      .put(`/admin/termini/${appointment._id}/preraspodeli`)
      .type("form")
      .send({ CSRFToken: token, employeeId: employee._id.toString() });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(String(updated.employee), String(employee._id));
    assert.equal(updated.assignedBy, "admin");
  });

  it("refuses to reassign to an employee who's already busy at that time", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { employee } = await createServiceAndEmployee();

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sharedTiming = { startTime: start, endTime: new Date(start.getTime() + 60 * 60000) };

    // the target employee is already booked at this exact time
    await appointmentRepo.createAppointment(
      validAppointmentData({
        ...sharedTiming,
        employee: employee._id,
        status: "confirmed",
        contactSnapshot: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", phone: "0601234567" },
      })
    );

    const appointmentToReassign = await appointmentRepo.createAppointment(
      validAppointmentData({ ...sharedTiming, status: "confirmed" })
    );

    const { token } = await getCsrfToken(agent, `/admin/termini/detalji/${appointmentToReassign._id}`);
    const res = await agent
      .put(`/admin/termini/${appointmentToReassign._id}/preraspodeli`)
      .type("form")
      .send({ CSRFToken: token, employeeId: employee._id.toString() });

    assert.equal(res.status, 302); // flash-redirected with an error, not a raw 400
    const unchanged = await appointmentRepo.findAppointmentById(appointmentToReassign._id);
    assert.notEqual(String(unchanged.employee), String(employee._id));
  });
});