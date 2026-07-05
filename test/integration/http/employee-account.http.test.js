import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";

async function createEmployeeSession(agent, { email = "zaposleni@example.com" } = {}) {
  const user = await registerAndLogin(agent, { email, roleName: "employee", firstName: "Ana", lastName: "Anic" });
  const employee = await employeeRepo.createEmployee({ userId: user._id, isActive: true });
  return { user, employee };
}

async function createAppointmentForEmployee(employeeId) {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/x.webp", imgDesc: "x" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
  });

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const appointment = await appointmentRepo.createAppointment({
    user: employeeId, // arbitrary valid ObjectId — the client identity isn't what this test exercises
    service: service._id,
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    employee: employeeId,
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: "0601234567" },
  });

  return { service, appointment };
}

describe("employee account routes (HTTP)", () => {
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

  it("redirects a logged-out visitor away from the employee area", async () => {
    const res = await request(app).get("/moj-nalog");
    assert.equal(res.status, 302);
  });

  it("forbids a plain 'user' from the employee area", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });

    const res = await agent.get("/moj-nalog");
    assert.equal(res.status, 403);
  });

  it("renders the employee dashboard", async () => {
    const agent = request.agent(app);
    await createEmployeeSession(agent);

    const res = await agent.get("/moj-nalog");
    assert.equal(res.status, 200);
  });

  it("renders the employee's own profile", async () => {
    const agent = request.agent(app);
    await createEmployeeSession(agent);

    const res = await agent.get("/moj-nalog/profil");
    assert.equal(res.status, 200);
  });

  it("updates the employee's own working hours", async () => {
    const agent = request.agent(app);
    const { employee } = await createEmployeeSession(agent);
    const { token } = await getCsrfToken(agent, "/moj-nalog/profil");

    const res = await agent.post("/moj-nalog/profil/radno-vreme").type("form").send({
      CSRFToken: token,
      "workingHours[0][day]": "monday",
      "workingHours[0][slots][0][from]": "09:00",
      "workingHours[0][slots][0][to]": "17:00",
    });

    assert.equal(res.status, 302);
    const updated = await employeeRepo.findEmployeeById(employee._id);
    assert.equal(updated.workingHours.length, 1);
    assert.equal(updated.workingHours[0].day, "monday");
  });

  // See the note above this file: employee.controller.js's confirmAppointment passes
  // req.session.user.id (a User id) to appointmentService.confirmAppointment, but
  // appointment.employee/assignedTo store Employee ids — a different document. If that
  // analysis is right, this test should fail with the appointment still "pending".
  it("confirms an appointment assigned to this employee", async () => {
    const agent = request.agent(app);
    const { employee } = await createEmployeeSession(agent);
    const { appointment } = await createAppointmentForEmployee(employee._id);

    const { token } = await getCsrfToken(agent, `/moj-nalog/termini/detalji/${appointment._id}`);
    const res = await agent.post(`/moj-nalog/termini/${appointment._id}/potvrdi`).type("form").send({ CSRFToken: token });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "confirmed");
  });
});