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

// Same reasoning as admin-appointment.http.test.js's ALL_WEEK_WORKING_HOURS -
// these tests book relative to Date.now(), so a single fixed weekday would fail
// intermittently depending on whenever the suite actually runs.
const ALL_WEEK_WORKING_HOURS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => ({
  day,
  slots: [{ from: "00:00", to: "23:59" }],
}));

async function createServiceWithVariantAndEmployee() {
  // createGuestUser (see appointment.service.js's bookAppointment, exercised
  // whenever an appointment is booked for a contact email with no matching
  // existing user) looks up the "user" role by name and throws a 400 if it
  // doesn't exist - registerAndLogin only ever ensures "admin"/whatever role
  // it's given, never "user", so walk-in/giveaway bookings need this too.
  await ensureRole("user");

  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: `sportska-masaza-${new mongoose.Types.ObjectId()}`,
    image: { img: "/images/services/x.webp", imgDesc: "x" },
    isActive: true,
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
  const employee = await employeeRepo.createEmployee({
    userId: employeeUser._id,
    services: [service._id],
    isActive: true,
    workingHours: ALL_WEEK_WORKING_HOURS,
  });

  const servicePackageId = service.packages[0]._id.toString();
  return { service, employee, servicePackageId };
}

function futureStart() {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0); // pinned away from midnight, same reasoning as elsewhere
  return start;
}

describe("admin manual appointment creation (HTTP)", () => {
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

  it("renders the form for an admin, listing the active service's variants", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { service } = await createServiceWithVariantAndEmployee();

    const res = await agent.get("/admin/termini/rucno-kreiranje");

    assert.equal(res.status, 200);
    // regression check for the bug where findActiveServices' public "card" shape
    // (no per-variant array) was used instead of the full service detail - the
    // service id must actually be present as a real option in the rendered form
    assert.match(res.text, new RegExp(service._id.toString()));
  });

  it("blocks a plain user (no manage_appointments_all permission) with a 403", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "kupac@example.com", roleName: "user" });

    const res = await agent.get("/admin/termini/rucno-kreiranje");

    assert.equal(res.status, 403);
  });

  it("creates a walk-in appointment at the catalog price, with no price override", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { service, servicePackageId } = await createServiceWithVariantAndEmployee();

    const { token } = await getCsrfToken(agent, "/admin/termini/rucno-kreiranje");
    const res = await agent
      .post("/admin/termini/rucno-kreiranje")
      .type("form")
      .send({
        CSRFToken: token,
        serviceId: service._id.toString(),
        servicePackageId,
        startTime: futureStart().toISOString(),
        firstName: "Marija",
        lastName: "Markovic",
        email: "marija-walkin@example.com",
        phone: "0611234567",
        note: "Walk-in klijent",
      });

    assert.equal(res.status, 302);

    const created = (await appointmentRepo.findAppointments({ search: "marija-walkin@example.com" })).data?.[0];
    assert.ok(created, "the appointment should have been created");
    assert.equal(created.variant.price, 3000); // catalog price, unchanged
    assert.equal(created.manualBooking, false);
  });

  it("creates a giveaway appointment with an admin-overridden price, and flags it as manualBooking", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { service, servicePackageId } = await createServiceWithVariantAndEmployee();

    const { token } = await getCsrfToken(agent, "/admin/termini/rucno-kreiranje");
    const res = await agent
      .post("/admin/termini/rucno-kreiranje")
      .type("form")
      .send({
        CSRFToken: token,
        serviceId: service._id.toString(),
        servicePackageId,
        startTime: futureStart().toISOString(),
        firstName: "Dobitnica",
        lastName: "Nagrade",
        email: "dobitnica@example.com",
        overridePrice: "1",
        priceOverride: "0",
        note: "Dobitnica nagradne igre na Instagramu",
      });

    assert.equal(res.status, 302);

    const created = (await appointmentRepo.findAppointments({ search: "dobitnica@example.com" })).data?.[0];
    assert.ok(created);
    assert.equal(created.variant.price, 0);
    assert.equal(created.finalPrice, 0);
    assert.equal(created.manualBooking, true);
  });

  it("resolves contact info from an existing registered user when existingUserId is given", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { service, servicePackageId } = await createServiceWithVariantAndEmployee();

    const userRole = await ensureRole("user");
    const existingUser = await userRepo.createUser({
      email: "postojeci-korisnik@example.com",
      password: "lozinka123",
      firstName: "Nikola",
      lastName: "Nikolic",
      role: userRole._id,
      status: "active",
      confirmed: true,
    });

    const { token } = await getCsrfToken(agent, "/admin/termini/rucno-kreiranje");
    const res = await agent
      .post("/admin/termini/rucno-kreiranje")
      .type("form")
      .send({
        CSRFToken: token,
        serviceId: service._id.toString(),
        servicePackageId,
        startTime: futureStart().toISOString(),
        existingUserId: existingUser._id.toString(),
        // form left contact fields blank - should fall back to the user's own record
        firstName: "",
        lastName: "",
        email: "",
      });

    assert.equal(res.status, 302);

    const created = (await appointmentRepo.findAppointments({ search: "postojeci-korisnik@example.com" })).data?.[0];
    assert.ok(created, "should resolve the contact info from the existing user and still find the appointment");
    assert.equal(String(created.user._id), String(existingUser._id));
    assert.equal(created.contactSnapshot.firstName, "Nikola");
  });

  it("rejects an out-of-range priceOverride with a validation error, not a 500", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { service, servicePackageId } = await createServiceWithVariantAndEmployee();

    const { token } = await getCsrfToken(agent, "/admin/termini/rucno-kreiranje");
    const res = await agent
      .post("/admin/termini/rucno-kreiranje")
      .type("form")
      .send({
        CSRFToken: token,
        serviceId: service._id.toString(),
        servicePackageId,
        startTime: futureStart().toISOString(),
        firstName: "Test",
        email: "los-unos@example.com",
        overridePrice: "1",
        priceOverride: "-100",
      });

    assert.equal(res.status, 400);
    const created = (await appointmentRepo.findAppointments({ search: "los-unos@example.com" })).data?.[0];
    assert.equal(created, undefined, "no appointment should have been created");
  });
});