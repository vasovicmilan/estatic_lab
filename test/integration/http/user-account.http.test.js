import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";

async function createAppointmentForUser(userId) {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/x.webp", imgDesc: "x" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
  });

  const start = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h out - safely inside the cancellation window

  const appointment = await appointmentRepo.createAppointment({
    user: userId,
    service: service._id,
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "confirmed",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: "0601234567" },
  });

  return { service, appointment };
}

describe("user account routes (HTTP)", () => {
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

  it("redirects a logged-out visitor away from the account area", async () => {
    const res = await request(app).get("/nalog");
    assert.equal(res.status, 302);
  });

  it("renders the logged-in user's profile", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });

    const res = await agent.get("/nalog");
    assert.equal(res.status, 200);
  });

  it("updates the user's own profile settings", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });
    const { token } = await getCsrfToken(agent, "/nalog/podesavanja");

    const res = await agent
      .post("/nalog/podesavanja")
      .type("form")
      .send({ CSRFToken: token, firstName: "Izmenjeno", lastName: "Prezime", phone: "0641112233" });

    assert.equal(res.status, 302);
    const user = await userRepo.findUserByEmail("korisnik@example.com");
    assert.equal(user.firstName, "Izmenjeno");
  });

  it("lists the user's own appointments", async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });
    await createAppointmentForUser(user._id);

    const res = await agent.get("/nalog/termini");
    assert.equal(res.status, 200);
  });

  it("cancels the user's own appointment with more than 24h notice", async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });
    const { appointment } = await createAppointmentForUser(user._id);

    const { token } = await getCsrfToken(agent, `/nalog/termini/detalji/${appointment._id}`);
    const res = await agent
      .post(`/nalog/termini/${appointment._id}/otkazi`)
      .type("form")
      .send({ CSRFToken: token, reason: "Predomislio sam se" });

    assert.equal(res.status, 302);
    const updated = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(updated.status, "cancelled");
  });

  it("refuses to cancel someone else's appointment", async () => {
    const ownerAgent = request.agent(app);
    const owner = await registerAndLogin(ownerAgent, { email: "vlasnik@example.com", roleName: "user" });
    const { appointment } = await createAppointmentForUser(owner._id);

    const outsiderAgent = request.agent(app);
    await registerAndLogin(outsiderAgent, { email: "drugi@example.com", roleName: "user" });

    const { token } = await getCsrfToken(outsiderAgent, "/nalog");
    const res = await outsiderAgent
      .post(`/nalog/termini/${appointment._id}/otkazi`)
      .type("form")
      .send({ CSRFToken: token, reason: "Pokusaj tudjeg otkazivanja" });

    assert.equal(res.status, 302); // flash-redirected with an error, not a raw 403
    const unchanged = await appointmentRepo.findAppointmentById(appointment._id);
    assert.equal(unchanged.status, "confirmed", "the appointment should remain untouched");
  });
});