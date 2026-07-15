import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import Role from "../../../src/models/role.model.js";

async function seedUserRole() {
  await Role.create({ name: "user", isDefault: true, priority: 0 });
}

async function createBookableService() {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/masaza.webp", imgDesc: "Sportska masaza" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
    isActive: true,
  });

  const role = await Role.create({ name: "employee", isDefault: false });
  await seedUserRole();

  const employeeUser = await userRepo.createUser({
    email: "terapeut@example.com",
    password: "lozinka123",
    firstName: "Ana",
    lastName: "Anic",
    role: role._id,
  });
  await employeeRepo.createEmployee({ userId: employeeUser._id, services: [service._id], isActive: true });

  return service;
}

function futureStartTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function extractCsrfToken(html) {
  const match = html.match(/name="CSRFToken" value="([^"]*)"/);
  return match ? match[1] : "";
}

describe("public booking flow (HTTP)", () => {
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

  describe("GET /zakazivanje/:serviceSlug/podaci", () => {
    it("renders the contact step for a valid service and variant", async () => {
      const service = await createBookableService();
      const variantId = service.packages[0]._id.toString();

      const res = await request(app).get(
        `/zakazivanje/${service.slug}/podaci?servicePackageId=${variantId}&startTime=${futureStartTime().toISOString()}`
      );

      assert.equal(res.status, 200);
      assert.match(res.text, /action="\/zakazivanje\/potvrda"/);
    });

    it("redirects back to service selection when the variant doesn't exist", async () => {
      const service = await createBookableService();

      const res = await request(app).get(
        `/zakazivanje/${service.slug}/podaci?servicePackageId=${new mongoose.Types.ObjectId()}&startTime=${futureStartTime().toISOString()}`
      );

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `/zakazivanje/${service.slug}`);
    });
  });

  describe("POST /zakazivanje/potvrda", () => {
    it("books an appointment as a guest, leaving it unassigned even though an employee is available", async () => {
      const service = await createBookableService();
      const variantId = service.packages[0]._id.toString();
      const startTime = futureStartTime().toISOString();

      const agent = request.agent(app);
      const contactPage = await agent.get(
        `/zakazivanje/${service.slug}/podaci?servicePackageId=${variantId}&startTime=${startTime}`
      );
      const token = extractCsrfToken(contactPage.text);

      const res = await agent.post("/zakazivanje/potvrda").type("form").send({
        CSRFToken: token,
        serviceSlug: service.slug,
        serviceId: service._id.toString(),
        servicePackageId: variantId,
        startTime,
        firstName: "Marko",
        lastName: "Markovic",
        email: "gost@example.com",
        phone: "0601234567",
      });

      assert.equal(res.status, 302);
      assert.match(res.headers.location, /^\/zakazivanje\/potvrda\//);

      const appointments = await appointmentRepo.findAppointments({});
      assert.equal(appointments.data.length, 1);
      assert.equal(appointments.data[0].contactSnapshot.email, "gost@example.com");
      // assignment is admin-driven now, not automatic — the booking only checks that
      // SOMEONE is free before accepting it, but doesn't commit to whoever that is
      assert.equal(appointments.data[0].employee, null, "no employee should be auto-assigned at booking time");
      assert.equal(appointments.data[0].assignedTo, null, "the appointment should stay unassigned until an admin assigns it");

      const guest = await userRepo.findUserByEmail("gost@example.com");
      assert.ok(guest, "a guest account should have been created for a first-time booker");
      assert.equal(guest.status, "guest");
    });

    it("rejects a booking in the past", async () => {
      const service = await createBookableService();
      const variantId = service.packages[0]._id.toString();
      const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const agent = request.agent(app);
      const contactPage = await agent.get(
        `/zakazivanje/${service.slug}/podaci?servicePackageId=${variantId}&startTime=${futureStartTime().toISOString()}`
      );
      const token = extractCsrfToken(contactPage.text);

      const res = await agent.post("/zakazivanje/potvrda").type("form").send({
        CSRFToken: token,
        serviceSlug: service.slug,
        serviceId: service._id.toString(),
        servicePackageId: variantId,
        startTime: pastTime,
        firstName: "Marko",
        lastName: "Markovic",
        email: "gost2@example.com",
        phone: "0601234567",
      });

      assert.equal(res.status, 400);
      const appointments = await appointmentRepo.findAppointments({});
      assert.equal(appointments.data.length, 0);
    });

    it("rejects booking when no employee is available for the service", async () => {
      await seedUserRole();

      const service = await serviceRepo.createService({
        name: "Usluga Bez Terapeuta",
        slug: "usluga-bez-terapeuta",
        image: { img: "/images/services/x.webp", imgDesc: "x" },
        packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 2000, isActive: true }],
        isActive: true,
      });
      const variantId = service.packages[0]._id.toString();
      const startTime = futureStartTime().toISOString();

      const agent = request.agent(app);
      const contactPage = await agent.get(
        `/zakazivanje/${service.slug}/podaci?servicePackageId=${variantId}&startTime=${startTime}`
      );
      const token = extractCsrfToken(contactPage.text);

      const res = await agent.post("/zakazivanje/potvrda").type("form").send({
        CSRFToken: token,
        serviceSlug: service.slug,
        serviceId: service._id.toString(),
        servicePackageId: variantId,
        startTime,
        firstName: "Marko",
        lastName: "Markovic",
        email: "gost3@example.com",
        phone: "0601234567",
      });

      assert.equal(res.status, 400);
    });
  });
});