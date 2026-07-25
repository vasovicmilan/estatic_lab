import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import packagePurchaseService from "../../../src/services/package-purchase.service.js";
import Role from "../../../src/models/role.model.js";

async function seedUserRole() {
  await Role.create({ name: "user", isDefault: true, priority: 0 });
}

async function createBookableServiceWithEmployee() {
  const service = await serviceRepo.createService({
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/masaza.webp", imgDesc: "Sportska masaza" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000, isActive: true }],
    isActive: true,
  });

  const employeeRole = await Role.create({ name: "employee", isDefault: false });
  await seedUserRole();

  const employeeUser = await userRepo.createUser({
    email: "terapeut@example.com",
    password: "lozinka123",
    firstName: "Ana",
    lastName: "Anic",
    role: employeeRole._id,
  });
  const employee = await employeeRepo.createEmployee({ userId: employeeUser._id, services: [service._id], isActive: true });

  return { service, employeeId: employee._id.toString() };
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

// Fires the full get-contact-page -> extract-csrf -> post-confirmation sequence as
// one independent "customer", each on their own agent (own session/cookie jar) -
// this is the realistic shape of two different people racing for the same slot,
// not one person double-clicking within a single session.
async function submitBooking(app, { service, variantId, employeeId, startTime, email }) {
  const agent = request.agent(app);
  const contactPage = await agent.get(
    `/zakazivanje/${service.slug}/podaci?servicePackageId=${variantId}&employeeId=${employeeId}&startTime=${startTime}`
  );
  const token = extractCsrfToken(contactPage.text);

  return agent.post("/zakazivanje/potvrda").type("form").send({
    CSRFToken: token,
    serviceSlug: service.slug,
    serviceId: service._id.toString(),
    servicePackageId: variantId,
    employeeId,
    startTime,
    firstName: "Kupac",
    lastName: "Test",
    email,
    phone: "0601234567",
  });
}

describe("booking concurrency (HTTP)", () => {
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

  it("only lets ONE of two simultaneous bookings for the same employee+slot succeed", async () => {
    const { service, employeeId } = await createBookableServiceWithEmployee();
    const variantId = service.packages[0]._id.toString();
    const startTime = futureStartTime().toISOString();

    // Fired truly in parallel (no await between them) - this is the actual race
    // condition bookAppointment's re-check-inside-the-transaction guard exists for.
    const [resultA, resultB] = await Promise.all([
      submitBooking(app, { service, variantId, employeeId, startTime, email: "kupac-a@example.com" }),
      submitBooking(app, { service, variantId, employeeId, startTime, email: "kupac-b@example.com" }),
    ]);

    const statuses = [resultA.status, resultB.status].sort();
    // exactly one booking succeeds (302 redirect to confirmation); the other must
    // be rejected with the standard thrown-badRequest 400 (same as every other
    // booking validation failure - see the sibling "rejects a booking in the
    // past" test), not silently accepted as a second booking for the same slot
    assert.deepEqual(statuses, [302, 400], "one request should redirect (success), the other should be rejected (400)");

    const appointments = await appointmentRepo.findAppointments({ filters: { employeeId } });
    assert.equal(appointments.data.length, 1, "only one appointment should exist for this employee at this exact time, not two");
  });

  it("allows both bookings when they're for different employees at the same time (not a real conflict)", async () => {
    const { service } = await createBookableServiceWithEmployee();
    const variantId = service.packages[0]._id.toString();
    const startTime = futureStartTime().toISOString();

    // a second, independent employee who can also perform this service
    const employeeRole = await Role.findOne({ name: "employee" });
    const secondEmployeeUser = await userRepo.createUser({
      email: "terapeut2@example.com",
      password: "lozinka123",
      firstName: "Jovana",
      lastName: "Jovanovic",
      role: employeeRole._id,
    });
    const secondEmployee = await employeeRepo.createEmployee({
      userId: secondEmployeeUser._id,
      services: [service._id],
      isActive: true,
    });

    const firstEmployee = await employeeRepo.findEmployeesByService(service._id);
    const employeeIdA = firstEmployee.find((e) => e.userId.toString() !== secondEmployeeUser._id.toString())._id.toString();
    const employeeIdB = secondEmployee._id.toString();

    const [resultA, resultB] = await Promise.all([
      submitBooking(app, { service, variantId, employeeId: employeeIdA, startTime, email: "kupac-a@example.com" }),
      submitBooking(app, { service, variantId, employeeId: employeeIdB, startTime, email: "kupac-b@example.com" }),
    ]);

    assert.equal(resultA.status, 302);
    assert.equal(resultB.status, 302);

    const appointments = await appointmentRepo.findAppointments({});
    assert.equal(appointments.data.length, 2, "two different employees booked at the same time is not a conflict");
  });

  it("only lets ONE of two simultaneous package-session reservations claim the last available session", async () => {
    const { service } = await createBookableServiceWithEmployee();
    const variantId = service.packages[0]._id.toString();

    const packageDoc = await packageRepo.createPackage({
      name: "Jedna Seansa Paket",
      slug: "jedna-seansa-paket",
      description: "Testni paket sa jednom seansom",
      items: [{ service: service._id, servicePackageId: variantId, sessions: 1 }],
      totalPrice: 3000,
      isActive: true,
    });

    const role = await Role.findOne({ name: "user" }) || (await Role.create({ name: "user", isDefault: true, priority: 0 }));
    const buyer = await userRepo.createUser({
      email: "kupac@example.com",
      password: "lozinka123",
      firstName: "Kupac",
      lastName: "Test",
      role: role._id,
      status: "active",
      confirmed: true,
    });

    const purchase = await packagePurchaseRepo.createPackagePurchase({
      user: buyer._id,
      userSnapshot: { firstName: buyer.firstName, lastName: buyer.lastName },
      package: packageDoc._id,
      items: [{ service: service._id, servicePackageId: variantId, sessionsTotal: 1, sessionsUsed: 0, sessionsReserved: 0, unitPrice: 3000 }],
      originalPrice: 3000,
      discountApplied: 0,
      pricePaid: 3000,
      purchasedBy: buyer._id,
    });

    // Two truly parallel reservation attempts against the SAME single-session
    // purchase - reserveSession's availableSessions() check must not let both
    // through just because they both read "1 available" before either commits.
    const results = await Promise.allSettled([
      packagePurchaseService.reserveSession(purchase._id.toString(), variantId),
      packagePurchaseService.reserveSession(purchase._id.toString(), variantId),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    assert.equal(succeeded.length, 1, "only one of the two concurrent reservations should succeed");
    assert.equal(failed.length, 1, "the other must be rejected (no sessions available), not silently double-reserved");

    const reloaded = await packagePurchaseRepo.findPackagePurchaseById(purchase._id);
    assert.equal(reloaded.items[0].sessionsReserved, 1, "sessionsReserved must never exceed sessionsTotal, even under a race");
  });
});