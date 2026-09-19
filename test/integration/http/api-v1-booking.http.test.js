import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import Role from "../../../src/models/role.model.js";

// Same setup pattern as booking.http.test.js (the web flow's own integration
// coverage) - reused here rather than reinvented, since it's exactly the same
// underlying appointmentService.bookAppointment/availabilityService.getAvailableSlots
// being exercised, just through the /api/v1 controller instead of the web one.
const ALL_WEEK_WORKING_HOURS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => ({
  day,
  slots: [{ from: "00:00", to: "23:59" }],
}));

async function createBookableService() {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/masaza.webp", imgDesc: "Sportska masaza" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
    isActive: true,
  });

  // A guest booking (no existing user with that email) makes bookAppointment create
  // a new guest user account, which needs the DEFAULT "user" role to assign - missing
  // this (as this test originally did) throws "Podrazumevana rola za korisnike nije
  // konfigurisana" for the guest path specifically, while the logged-in path (an
  // account that already exists) never hits this lookup at all. Same seedUserRole()
  // this pattern is copied from in booking.http.test.js (the web flow's own coverage).
  await Role.create({ name: "user", isDefault: true, priority: 0 });

  const role = await Role.create({ name: "employee", isDefault: false });
  const employeeUser = await userRepo.createUser({
    email: "terapeut@example.com",
    password: "lozinka123",
    firstName: "Ana",
    lastName: "Anic",
    role: role._id,
  });
  await employeeRepo.createEmployee({ userId: employeeUser._id, services: [service._id], isActive: true, workingHours: ALL_WEEK_WORKING_HOURS });

  return service;
}

function futureStartTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

describe("API v1 booking routes (HTTP)", () => {
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

  it("GET /booking/:slug/slots returns available slots for a bookable service, unauthenticated", async () => {
    const service = await createBookableService();
    const variantId = service.packages[0]._id.toString();
    // Explicit future date, not "today" - the sole employee works 00:00-23:59,
    // but getAvailableSlots correctly drops any slot whose start has already
    // passed (see availability.service.js) - run this suite late enough in the
    // evening and "today" can legitimately have zero slots left, which isn't a
    // bug, just this test being time-of-day dependent for no reason. Tomorrow
    // always has its full day ahead regardless of when the suite runs.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateParam = tomorrow.toISOString().slice(0, 10);

    const res = await request(app).get(`/api/v1/booking/${service.slug}/slots?servicePackageId=${variantId}&date=${dateParam}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.slots));
    assert.ok(res.body.data.slots.length > 0, "the sole employee works all week, so slots should exist");
    assert.equal(res.body.data.usablePackagePurchase, undefined, "a guest request should never see this field at all");
  });

  it("400s with a JSON error when servicePackageId is missing", async () => {
    const service = await createBookableService();
    const res = await request(app).get(`/api/v1/booking/${service.slug}/slots`);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("POST /booking/confirm books an appointment as a guest, auto-assigning the sole available employee", async () => {
    const service = await createBookableService();
    const variantId = service.packages[0]._id.toString();
    const startTime = futureStartTime().toISOString();

    const res = await request(app).post("/api/v1/booking/confirm").send({
      serviceId: service._id.toString(),
      servicePackageId: variantId,
      startTime,
      firstName: "Marko",
      lastName: "Markovic",
      email: "gost@example.com",
      phone: "0601234567",
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.appointment.id);

    const appointments = await appointmentRepo.findAppointments({});
    assert.equal(appointments.data.length, 1);
    assert.equal(appointments.data[0].contactSnapshot.email, "gost@example.com");
  });

  it("books an appointment for a logged-in caller via Bearer token, attached to their account", async () => {
    const service = await createBookableService();
    const variantId = service.packages[0]._id.toString();
    const startTime = futureStartTime().toISOString();

    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "korisnik@example.com", password: "lozinka123" });
    // See api-v1-admin-appointment-order.http.test.js's loginAsAdmin for why
    // this diagnostic exists - same unexplained failure, need the real
    // response body/status to actually find the cause instead of guessing.
    if (!loginRes.body?.data?.token) {
      throw new Error(`login did not get a token - status=${loginRes.status} body=${JSON.stringify(loginRes.body)} text=${loginRes.text?.slice(0, 500)}`);
    }
    const { token } = loginRes.body.data;

    const res = await request(app)
      .post("/api/v1/booking/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        servicePackageId: variantId,
        startTime,
        firstName: "Korisnik",
        email: "korisnik@example.com",
        phone: "0601234567",
      });

    assert.equal(res.status, 201);
    const appointments = await appointmentRepo.findAppointments({});
    assert.ok(appointments.data[0].user, "the appointment should be attached to the logged-in user, not left as a guest booking");
  });

  it("returns a JSON 400 validation error for a malformed confirm body", async () => {
    const res = await request(app).post("/api/v1/booking/confirm").send({ firstName: "Marko" }); // missing everything else required

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.details);
  });
});
